import cv2, numpy as np, sys
ph=cv2.imread('photo_rot.png'); sc=cv2.imread('scan.jpeg')
S=0.45  # scan downscale for matching
scs=cv2.resize(sc,None,fx=S,fy=S,interpolation=cv2.INTER_AREA)
gph=cv2.cvtColor(ph,cv2.COLOR_BGR2GRAY); gsc=cv2.cvtColor(scs,cv2.COLOR_BGR2GRAY)
sift=cv2.SIFT_create(nfeatures=0,contrastThreshold=0.02)
def region_H(pbox, sbox):
    """pbox in photo coords, sbox in full scan coords -> H mapping photo->full scan"""
    x0,y0,x1,y1=pbox; a0,b0,a1,b1=[int(v*S) for v in sbox]
    k1,d1=sift.detectAndCompute(gph[y0:y1,x0:x1],None)
    k2,d2=sift.detectAndCompute(gsc[b0:b1,a0:a1],None)
    bf=cv2.BFMatcher(); mm=bf.knnMatch(d1,d2,k=2)
    good=[m for m,n in mm if m.distance<0.8*n.distance]
    p1=np.float32([[k1[m.queryIdx].pt[0]+x0,k1[m.queryIdx].pt[1]+y0] for m in good])
    p2=np.float32([[(k2[m.trainIdx].pt[0]+a0)/S,(k2[m.trainIdx].pt[1]+b0)/S] for m in good])
    H,mask=cv2.findHomography(p1,p2,cv2.RANSAC,6.0)
    inl=int(mask.sum()) if mask is not None else 0
    return H,len(good),inl,p1[mask.ravel()==1],p2[mask.ravel()==1]
