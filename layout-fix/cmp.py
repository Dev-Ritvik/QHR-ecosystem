import cv2, numpy as np, sys
a=cv2.imread('scan.jpeg'); b=cv2.imread(sys.argv[1])
def pair(box,scale,name):
    x0,y0,x1,y1=box
    A=cv2.resize(a[y0:y1,x0:x1],None,fx=scale,fy=scale,interpolation=cv2.INTER_CUBIC)
    B=cv2.resize(b[y0:y1,x0:x1],None,fx=scale,fy=scale,interpolation=cv2.INTER_CUBIC)
    cv2.imwrite(name,np.hstack([A,np.full((A.shape[0],12,3),(0,160,255),np.uint8),B]))
pair((680,1280,1080,2100),1.5,'cmpA.png')
pair((990,1640,1560,1800),1.4,'cmpA2.png')
pair((1680,1740,2100,1920),1.9,'cmpB.png')
pair((1960,370,2380,1080),1.4,'cmpC.png')
