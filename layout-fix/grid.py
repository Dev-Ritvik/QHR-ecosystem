import cv2, numpy as np, sys
def grid(img, box, scale, out, step=50):
    x0,y0,x1,y1=box
    c=img[y0:y1,x0:x1].copy()
    c=cv2.resize(c,None,fx=scale,fy=scale,interpolation=cv2.INTER_CUBIC)
    for x in range((x0//step+1)*step,x1,step):
        X=int((x-x0)*scale); cv2.line(c,(X,0),(X,c.shape[0]),(0,200,0) if x%100 else (0,140,255),1)
        if x%100==0: cv2.putText(c,str(x),(X+2,12),cv2.FONT_HERSHEY_SIMPLEX,0.4,(0,100,200),1)
    for y in range((y0//step+1)*step,y1,step):
        Y=int((y-y0)*scale); cv2.line(c,(0,Y),(c.shape[1],Y),(0,200,0) if y%100 else (0,140,255),1)
        if y%100==0: cv2.putText(c,str(y),(2,Y-2),cv2.FONT_HERSHEY_SIMPLEX,0.4,(0,100,200),1)
    cv2.imwrite(out,c)
if __name__=='__main__':
    img=cv2.imread(sys.argv[1]); b=[int(v) for v in sys.argv[2:6]]
    grid(img,b,float(sys.argv[6]),sys.argv[7])
