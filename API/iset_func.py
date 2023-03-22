import random

def iset_add(r,name,intervalMapping):
    '''
        Add members with intervals to interval set. If interval set does not exist, it will be created. 
        In reality, it will create two Redis Sorted Sets for starts and ends of the intervals.
        The rest of the functions ``iset_`` will know what to do with them.
        
        ``r``: Redis object. Redis client.
        ``name``: string. Name of the interval set.
        ``intervalMapping``: dict. Dictionary with names of intervals as keys and 
                tuples with start and end of intervals.
                
        
        Return number of added intervals. In reality, it adds equal number of elements 
        to two sorted sets, if number of added elements are not equal, DataError is raised.
        
    '''
    starts = {f'{n}_{seqnum}':int(interval[0]) for n,inv in intervalMapping.items() for seqnum,interval in enumerate(inv)}
    ends = {f'{n}_{seqnum}':int(interval[1]) for n,inv in intervalMapping.items() for seqnum,interval in enumerate(inv)}
    numAddedStarts = r.zadd(f'{name}Start',mapping=starts)
    numAddedEnds = r.zadd(f'{name}End',mapping=ends)
    if numAddedStarts!=numAddedEnds:
        raise DataError(f'Not equal number of starts and ends were added to DB. For consistency, the sorted sets {name}Start and {name}End should be checked and/or recreated')
    return numAddedStarts

# %% ../04_utils.ipynb 25
def iset_get(r,name,member=None):
    '''
        Return either the whole interval set or specific name(s) with its interval.
        
        ``r``: Redis object. Redis client.
        ``name``: string. Name of the interval set.
        ``member``: string, list, tuple or None. If None, function return all members with their respective intervals.
            If string, returns a single member with its interval,
            if list or tuple, returns all requested members with their respecitve intervals.

        Return a dictionary with member names as keys and tuples with interval starts and ends as values.
        For member names not found in interval set, the value for the given key will be a tuple (None,None).
    '''
    if member is None:
        starts = {k.decode():v for k,v in r.zrange(f'{name}Start',0,-1,withscores=True)}
        ends = {k.decode():v for k,v in r.zrange(f'{name}End',0,-1,withscores=True)}
        return {k:(starts[k],ends[k])for k in starts.keys()}
    elif isinstance(member,str):
        intStart = r.zscore(f'{name}Start',member)
        intEnd = r.zscore(f'{name}End',member)
        return {member: (intStart, intEnd)}
    else:
        res = {}
        for mm in member:
            intStart = r.zscore(f'{name}Start',mm)
            intEnd = r.zscore(f'{name}End',mm)
            res[mm] = (intStart, intEnd)
        return res

# %% ../04_utils.ipynb 26
def iset_score(r,name,start,end=None):
    '''
        Returns all member names whose interval contains a given value or intersects with the given interval
        
        ``r``: Redis object. Redis client.
        ``name``: string. Name of the interval set
        ``start``: int. Query value or the start of query interval.
        ``end``: int or None. If None, ``start`` is treated as a single query value. 
                If int, then ``start`` is the start of the query interval, 
                ``end`` is the end of the query interval.
                
        Returns a list of members whose intervals either contain query value or intersects with query interval.
    '''
    if end:
        _endPos = end
    else:
        _endPos = start
    if _endPos<start:
        raise ValueError('``start`` should be less or equal to ``end``.')
    tid = random.randint(1e8,1e9-1)
#     r.execute_command('ZRANGESTORE',*['startSetTemp','geneStart','-inf',_endPos,'BYSCORE'])
#     r.execute_command('ZRANGESTORE',*['endSetTemp','geneEnd',start,'inf','BYSCORE'])
    r.zrangestore(f'startSetTemp_{tid}',f'{name}Start','-inf',_endPos,byscore=True)
    r.zrangestore(f'endSetTemp_{tid}',f'{name}End',start,'inf',byscore=True)
    res = ['_'.join(el.decode().split('_')[:-1]) for el in r.zinter([f'startSetTemp_{tid}',f'endSetTemp_{tid}'])]
    r.delete(f'startSetTemp_{tid}',f'endSetTemp_{tid}')
    return res

# %% ../04_utils.ipynb 27
def iset_not_score(r,name,start,end=None):
    '''
        Returns all intervals (member names only) where query value is not contained or query interval is not intersecting.
        Inverison of ``iset_score()`` function
        
        ``r``: Redis object. Redis client.
        ``name``: string. Name of the interval set
        ``start``: int. Query value or the start of query interval.
        ``end``: int or None. If None, ``start`` is treated as a single query value. 
                If int, then ``start`` is the start of the query interval, 
                ``end`` is the end of the query interval.
                
        Returns a list of members whose intervals either does not contain query value or does not intersect with query interval.
    
    '''
    if end:
        _endPos = end
    else:
        _endPos = start
    if _endPos<start:
        raise ValueError('``start`` should be less or equal to ``end``.')
    tid = random.randint(1e8,1e9-1)

    r.zrangestore(f'startSetTemp_{tid}',f'{name}Start','-inf',_endPos,byscore=True)
    r.zrangestore(f'endSetTemp_{tid}',f'{name}End',start,'inf',byscore=True)
    r.zinterstore(f'foundSetTemp_{tid}',[f'startSetTemp_{tid}',f'endSetTemp_{tid}'])
    r.zrangestore(f'allSetTemp_{tid}',f'{name}Start','-inf','inf',byscore=True)
    res = [el.decode() for el in (r.zdiff([f'allSetTemp_{tid}',f'foundSetTemp_{tid}']))]
    r.delete(f'startSetTemp_{tid}',f'endSetTemp_{tid}',f'allSetTemp_{tid}',f'foundSetTemp_{tid}')
    
    return res

# %% ../04_utils.ipynb 28
def iset_del(r,name,member=None):
    '''
        Return either the whole interval set or specific name(s) with its interval.
        
        ``r``: Redis object. Redis client.
        ``name``: string. Name of the interval set.
        ``member``: string, list, tuple or None. If None, function return all members with their respective intervals.
            If string, returns a single member with its interval,
            if list or tuple, returns all requested members with their respecitve intervals.

        Return number of removed intervals. In reality, it removes equal number of elements 
        from two sorted sets, if number of added elements are not equal, DataError is raised.
    '''
    if member is None:
        keyRemovedStart = r.delete(f'{name}Start')
        keyRemovedEnd = r.delete(f'{name}End')
        if keyRemovedStart==1 and keyRemovedEnd==1:
            return 1
        else:
            raise DataError('Less than two sorted sets were deleted. Something is wrong with the Redis DB.')
    elif isinstance(member,str):
        removedStartCount = r.zrem(f'{name}Start',member)
        removedEndCount = r.zrem(f'{name}End',member)
    else:
        removedStartCount = r.zrem(f'{name}Start',*member)
        removedEndCount = r.zrem(f'{name}End',*member)
    
    if removedStartCount==removedEndCount:
        return removedStartCount
    else:
        raise DataError(f'Not equal number of starts and ends were deleted from DB. \
        For consistency, the sorted sets {name}Start and {name}End should be checked and/or recreated')
