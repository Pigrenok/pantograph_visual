from flask import Flask
from flask_cors import CORS
from markupsafe import escape

import numpy as np

from iset_func import iset_score,iset_get

from redis import Redis

from os import environ
from dotenv import dotenv_values

config = {
    **dotenv_values(".env"),  # load sensitive variables
    **environ,  # override loaded values with environment variables
}

REDIS_HOST = config.get("REDIS_HOST",'redis')
REDIS_PORT = int(config.get("REDIS_PORT","6379"))
REDIS_DBID = int(config.get("REDIS_DBID","0"))

app = Flask(__name__)
CORS(app)

def combineIntervals(posPath):
    # posPath = pos.get(pathID)
    posArray = np.array(posPath)
    posArray = posArray[np.argsort(posArray[:,0]),:]
    posIntersect = (posArray[1:,1]-(posArray[:-1,0]-1))*\
                    (posArray[:-1,1]-(posArray[1:,0]-1))
    newPos = [[posArray[0,0]]]
    candidates = [posArray[0,1]]
    for jointNum in range(len(posIntersect)):
        if posIntersect[jointNum]>=0:
            candidates.extend(posArray[jointNum+1,:].tolist())
        else:
            newPos[-1].append(np.max(candidates))
            newPos.append([posArray[jointNum+1,0]])
            candidates = [posArray[jointNum+1,1]]

    newPos[-1].append(np.max(candidates))# !!!!    
    return newPos

@app.route('/annotation/<caseName>/<accession>/<colStart>/<colEnd>')
def getBinAnn(caseName,accession,colStart,colEnd):
	print("case name is ",caseName)
	r = Redis(host=REDIS_HOST,port=REDIS_PORT,db=REDIS_DBID)

	resGene = iset_score(r,f'{caseName}.{accession}.Gene',int(colStart),int(colEnd))
	strGenes = ','.join(resGene)

	resPos = iset_score(r,f'{caseName}.{accession}.GenPos',int(colStart),int(colEnd))
	if len(resPos)>1:
		combPos = {}
		combPanPos = {}
		for posComb in resPos:
			posCSplit = posComb.split('|')

			chrPos,intPos = posCSplit[0].split(':')
			start,end = intPos.split('..')
			combPos.setdefault(chrPos,[]).append((int(start),int(end)))

			if len(posCSplit)>1:
				chrPan,intPan = posCSplit[1].split(':')
				pstart,pend = intPan.split('..')
				combPanPos.setdefault(chrPan,[]).append((int(pstart),int(pend)))

		strPos = ''
		for chrPos,intList in combPos.items():
			for interval in combineIntervals(intList): # Should it be done by combining all intervals or 
													   # should it be min(starts),max(ends) just to get the region 
													   # where the component is located. The latter can be very crude on high level,
													   # but the former can generate enormous amount of links on high level.
				strPos += f'{chrPos}:{interval[0]}..{interval[1]},'
		strPos = strPos.rstrip(',')

		strPan = ''
		if len(combPanPos)>0:
			for chrPan,intList in combPanPos.items():
				for interval in combineIntervals(intList): # Should it be done by combining all intervals or 
														   # should it be min(starts),max(ends) just to get the region 
														   # where the component is located. The latter can be very crude on high level,
														   # but the former can generate enormous amount of links on high level.
					strPan += f'{chrPan}:{interval[0]}..{interval[1]},'
			strPan = strPan.rstrip(',')
	else:
		if len(resPos)>0:
			posCSplit = resPos[0].split('|')
			strPos = posCSplit[0]

			if len(posCSplit)>1:
				strPan = posCSplit[1]
			else:
				strPan = ''
		else:
			strPan = ''
			strPos = ''


	resAltPos = iset_score(r,f'{caseName}.{accession}.AltChrGenPos',int(colStart),int(colEnd))
	if len(resAltPos)>1:
		combAltPos = {}
		for posComb in resAltPos:
			chrPos,intPos = posComb.split(':')
			start,end = intPos.split('..')
			combAltPos.setdefault(chrPos,[]).append((int(start),int(end)))
		strAltPos = ''
		for chrPos,intList in combAltPos.items():
			for interval in combineIntervals(intList): # Should it be done by combining all intervals or 
													   # should it be min(starts),max(ends) just to get the region 
													   # where the component is located. The latter can be very crude on high level,
													   # but the former can generate enormous amount of links on high level.
				strAltPos += f'{chrPos}:{interval[0]}..{interval[1]},'
		strAltPos = strAltPos.rstrip(',')
	else:
		strAltPos = ','.join(resAltPos)

	# if len(resGene)>0 or len(resPos)>0:
	return f'{strGenes};{strPos};{strAltPos};{strPan}'
	# else:
	# 	return '-1'

@app.route('/gene/<caseName>/<accession>/<geneName>')
def getGeneBin(caseName,accession,geneName):
	print("case name is ",caseName)
	r = Redis(host=REDIS_HOST,port=REDIS_PORT,db=REDIS_DBID)

	res = iset_get(r,f'{caseName}.{accession}.Gene',f'{geneName}_0')
	if res is not None:
		return str(int(res[f'{geneName}_0'][0]))# change this as it should return a pair. We need to return only first number.
	else:
		return '-1'

@app.route('/pos/<caseName>/<accession>/<zoomLevel>/<position>')
def getPositionBin(caseName,accession,zoomLevel,position):
	r = Redis(host=REDIS_HOST,port=REDIS_PORT,db=REDIS_DBID)
	# print(f'{caseName}.{zoomLevel}.{accession}.Pos')
	res = iset_score(r,f'{caseName}.{zoomLevel}.{accession}.Pos',int(position))
	if len(res)>0:
		return res[0]
	else:
		return '-1'

# Search over actual genomic position.
@app.route('/genpos/<caseName>/<accession>/<genPosition>')
def getGenPositionCol(caseName,accession,genPosition):
	r = Redis(host=REDIS_HOST,port=REDIS_PORT,db=REDIS_DBID)
	# print(f'{caseName}.{accession}.Pos')
	res = iset_score(r,f'{caseName}.{accession}.GenPosSearch',int(genPosition))
	if len(res)>0:
		return res[0]
	else:
		return '-1'

if __name__=='__main__':
	app.run(debug=True)