import cv2, numpy as np
src=cv2.imread('scan.jpeg')           # BGR, decoded original
img=src.copy()
H,W=img.shape[:2]
YY,XX=np.mgrid[0:H,0:W]
BLUE=(230,5,3); NAVY=(24,3,2); RED=(14,10,200); BLK=(30,30,30); GRY=(125,120,120)
BW=4.6; WN=4.4
def navy(p,q,side):
    # navy boundary with the faint plot-outline companion the original lines carry; side=+1 puts it on the right/below
    p=np.array(p,float); q=np.array(q,float); d=(q-p)/np.linalg.norm(q-p); n=np.array([-d[1],d[0]])*3.5*side
    line(p+n,q+n,GRY,2.4); line(p,q,NAVY,WN)

def band(pts,u1,u2):
    m=np.zeros((H,W),np.uint8)
    pts=[np.array(p,float) for p in pts]
    poly=[p+np.array(u1) for p in pts]+[p+np.array(u2) for p in reversed(pts)]
    cv2.fillPoly(m,[np.round(np.array(poly)).astype(np.int32)],255)
    return m>0
def rect(x0,y0,x1,y1):
    m=np.zeros((H,W),bool); m[y0:y1,x0:x1]=True; return m
ERASED=np.zeros((H,W),bool)
def erase(m):
    img[m]=255; ERASED[m]=True
def line(p,q,color,width,SS=8):
    p=np.array(p,float); q=np.array(q,float)
    pad=int(width)+4
    x0=int(min(p[0],q[0]))-pad; y0=int(min(p[1],q[1]))-pad; x1=int(max(p[0],q[0]))+pad+1; y1=int(max(p[1],q[1]))+pad+1
    m=np.zeros(((y1-y0)*SS,(x1-x0)*SS),np.uint8)
    d=(q-p)/np.linalg.norm(q-p); n=np.array([-d[1],d[0]])*width/2
    # butt-capped quad; pixel centres at integer coords -> +0.5 in supersampled space
    quad=np.array([p+n,q+n,q-n,p-n])
    quad=((quad-[x0,y0]+0.5)*SS).round().astype(np.int32)
    cv2.fillPoly(m,[quad],255)
    a=cv2.resize(m,(x1-x0,y1-y0),interpolation=cv2.INTER_AREA).astype(float)/255
    roi=img[y0:y1,x0:x1].astype(float)
    img[y0:y1,x0:x1]=(roi*(1-a[...,None])+np.array(color,float)*a[...,None]).round().astype(np.uint8)
def poly_line(pts,color,width):
    for a,b in zip(pts[:-1],pts[1:]): line(a,b,color,width)
    for p in pts[1:-1]: dot(p,color,width)
def dot(p,color,width,SS=8):
    r=int(width)+3; x0=int(p[0])-r; y0=int(p[1])-r; s=2*r+1
    m=np.zeros((s*SS,s*SS),np.uint8)
    c=(int(round((p[0]-x0+0.5)*SS)),int(round((p[1]-y0+0.5)*SS)))
    cv2.circle(m,c,int(round(width/2*SS)),255,-1)
    a=cv2.resize(m,(s,s),interpolation=cv2.INTER_AREA).astype(float)/255
    roi=img[y0:y0+s,x0:x0+s].astype(float)
    img[y0:y0+s,x0:x0+s]=(roi*(1-a[...,None])+np.array(color,float)*a[...,None]).round().astype(np.uint8)
def rep_rows(x0,x1,srcrow,y0,y1):   # vertical line: repeat one clean row of the ORIGINAL
    img[y0:y1,x0:x1]=src[srcrow,x0:x1][None,:,:]
def rep_cols(y0,y1,srccol,x0,x1):   # horizontal line: repeat one clean column of the ORIGINAL
    img[y0:y1,x0:x1]=src[y0:y1,srccol][:,None,:]

# ================= A: plots 1-2-3 =================
TL=(786.0,1391.0); TR=(945.0,1423.0); WB=(755.3,1933.5)
yt=lambda x: TL[1]+(x-TL[0])*(TR[1]-TL[1])/(TR[0]-TL[0])
xw=lambda y: TL[0]+(y-TL[1])*(WB[0]-TL[0])/(WB[1]-TL[1])
# old west boundary (blue) with its dimension text, below the new top line
erase(band([(840,1388),(773,1583),(722,1763)],(-15,0),(9,0)) & (YY>yt(XX)+3))
erase(band([(722,1763),(708.5,1902)],(-9,0),(13,0)))
erase(band([(700,1897),(760,1936.5)],(0,-14),(0,9)) & (XX<xw(YY)+1))
erase(band([(730,1916),(763,1938.5)],(0,-14),(0,-3)))          # rest of that edge's dimension text
# old top of plot 1 and old slanted east edge
erase(band([(852,1368),(1000,1413)],(0,-7),(0,17)))
erase(band([(997,1406),(958,1584),(945,1648)],(-17,0),(7,0)))
# 2/3 divider: the part left of the new west line
erase(rect(704,1755,763,1775))
# old boundary across the road end and 7A tip, and the road-line stub left of the new line
erase(band([(786,1953),(830,1983),(897,2016),(1003,2066.5)],(0,-10),(0,10)) & (YY>=1959))
erase(band([(915,2022),(1003,2066.5)],(0,-15),(0,10)))
erase(rect(880,2005,943,2027))
# restore lines the erasing clipped
rep_cols(1576,1592,920,930,943)                # 1/2 divider, right end up to the east edge
rep_cols(1576,1592,800,int(xw(1584))-1,790)    # 1/2 divider, left end
rep_cols(1944,1961,815,789,812)                # plot 3 bottom line near its left corner
erase(rect(774,1958,790,1970))
# new lines
rep_rows(938,952,1900,int(round(yt(945)))-1,1652)   # east edge of plots 1-2, straight, same red+black as below
rep_cols(1576,1592,920,930,943)                # 1/2 divider meets the straightened east edge
P=(836.0,yt(836.0))
line(P,(946.5,yt(946.5)),RED,3.2)
line((P[0],P[1]+2.4),(944.0,yt(944.0)+2.4),BLK,1.6)
line(TL,P,BLUE,BW); line(TL,WB,BLUE,BW); dot(TL,BLUE,BW); dot(WB,BLUE,BW)
line((945,1957),(945,2014),BLUE,BW)
line((1007.5,2019),(1007.5,2068),BLUE,BW)

# ================= A2: plots 4-5-6 =================
N0=(1008.0,1705.0); N1=(1470.0,1740.0)
yn=lambda x: N0[1]+(x-N0[0])*(N1[1]-N0[1])/(N1[0]-N0[0])
erase(rect(1012,1674,1046,1730))
erase(band([(1021,1692),(1100,1704),(1162,1715),(1280,1726),(1317,1731),(1466,1759)],(0,-10),(0,18)) & (XX>=1012)&(XX<=1465))
rep_rows(1150,1176,1800,int(yn(1162))-1,1740)   # 4/5 divider top
rep_rows(1305,1330,1800,int(yn(1317))-1,1752)   # 5/6 divider top
navy(N0,N1,+1)
line((1008,1669),(1008,1705),NAVY,WN); dot(N0,NAVY,WN)
erase(rect(1463,1750,1468,1763))
line((1470,1740),(1470,1761),NAVY,WN); dot(N1,NAVY,WN)


# ================= B: plots 21-22 =================
# geometry of 22's slanted north-west edge, fitted on its clean stretch
ys=np.arange(1772,1796); cx=[]
for y in ys:
    row=src[y,2015:2060].astype(int); ink=(255-row.max(axis=1)); ink[ink<120]=0
    cx.append(2015+(ink*np.arange(len(ink))).sum()/ink.sum())
a,b=np.polyfit(ys,cx,1); xe=lambda y: a*y+b          # edge centre x at row y
erase(band([(1827,1812),(1903,1837),(1992,1860)],(0,-11),(0,17)) & (XX>=1827))
erase(band([(xe(1870),1870),(xe(1797),1797)],(-9,0),(19,0)))
m=np.zeros((H,W),np.uint8); cv2.circle(m,(1993,1862),11,255,-1); erase(m>0)
prof=np.median(src[1798:1824,1796:1822].astype(float),axis=1).round().astype(np.uint8)
img[1798:1824,1827:int(xe(1814))+3]=prof[:,None,:]
rep_rows(1893,1913,1868,1817,1858)      # 21 east edge carried up to the new line
rep_rows(1958,1978,1876,1817,1876)      # 22 west edge carried up to the new line
# the slanted edge between the new line and its untouched stretch: slide a copy of the clean stretch down along the edge
D=20; sh=-a*D; print('edge slope',a,'shift',sh)
for y in range(1796,1816):
    xc=int(round(xe(y))); xs=np.arange(xc-9,xc+11)
    rowsrc=src[y-D].astype(np.float32)
    xf=xs+sh; x0=np.floor(xf).astype(int); f=(xf-x0)[:,None]
    img[y,xs]=np.minimum(img[y,xs],(rowsrc[x0]*(1-f)+rowsrc[x0+1]*f).round().astype(np.uint8))

# ================= C: plots 40-43 =================
NE=(2338.5,457.0); CT=(2127.0,434.5); V=(2037.0,897.0); E=(2024.0,1031.0)
ync=lambda x: NE[1]-(NE[0]-x)*(NE[1]-CT[1])/(NE[0]-CT[0])
xwc=lambda y: CT[0]+(y-CT[1])*(V[0]-CT[0])/(V[1]-CT[1])
erase(band([(2341,458.5),(2214,403)],(0,-14),(0,9)) & (YY<ync(XX)-3) & (XX<2336))
m=np.zeros((H,W),np.uint8); cv2.circle(m,(2214,403),13,255,-1); cv2.circle(m,(2014,905),10,255,-1); erase(m>0)
erase(band([(2214,403),(2164,482),(2113,594)],(-19,0),(9,0)))
erase(band([(2113,594),(2100,650),(2080,749),(2073,778),(2038,833),(2013,908)],(-18,0),(9,0)))
erase(rect(2002,892,2036,913))
rep_cols(584,604,2150,int(xwc(594)),2126)     # 43/42 divider carried out to the new line
rep_cols(739,759,2110,int(xwc(749)),2092)     # 42/41 divider carried out to the new line
line(NE,CT,BLUE,BW); line(CT,V,BLUE,BW); line(V,E,BLUE,BW); dot(CT,BLUE,BW); dot(V,BLUE,BW)
# faint JPEG ghosts of the removed lines: near-white specks close to erased strokes and away from any remaining ink
zone=cv2.dilate(ERASED.astype(np.uint8),np.ones((33,33),np.uint8))>0
mn=img.min(axis=2)
ink=cv2.dilate((mn<200).astype(np.uint8),np.ones((7,7),np.uint8))>0
ghost=zone&(mn>=225)&(mn<255)&~ink
img[ghost]=255; print('ghost px cleaned',int(ghost.sum()))
cv2.imwrite('edit_geom.png',img)
exec(open('labels.py').read())
cv2.imwrite('edit_final.png',img)
