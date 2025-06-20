
import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { NotFoundException } from "@zxing/library";

interface BarcodeScannerDialogProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

const BarcodeScannerDialog: React.FC<BarcodeScannerDialogProps> = ({
  open,
  onClose,
  onDetected,
}) => {
  const [scanning, setScanning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [lastDetectionTime, setLastDetectionTime] = React.useState(0);
  const scannerRef = React.useRef<BrowserMultiFormatReader | null>(null);
  const barcodeDetectorRef = React.useRef<any>(null);
  const animationRef = React.useRef<number | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const controlsRef = React.useRef<any>(null);

  const stopScanning = async () => {
    console.log("Stopping scanner...");

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (barcodeDetectorRef.current) {
      barcodeDetectorRef.current = null;
    }
    
    // Stop the scanning controls if they exist
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
        console.log("Scanner controls stopped successfully");
      } catch (err) {
        console.log("Error stopping scanner controls:", err);
      }
      controlsRef.current = null;
    }

    // Clean up scanner reference
    if (scannerRef.current) {
      scannerRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setScanning(false);
    setError(null);
    setSuccess(false);
  };

  const startScanning = async () => {
    console.log("=== STARTING BARCODE SCANNER ===");
    setError(null);
    setSuccess(false);
    setScanning(true);
    setLastDetectionTime(0);

    try {
      if (!videoRef.current) {
        throw new Error("Video element not found");
      }

      if ("BarcodeDetector" in window) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const Detector = (window as any).BarcodeDetector;
        barcodeDetectorRef.current = new Detector({ formats: ["ean_13", "ean_8", "code_128", "code_39", "qr_code"] });

        const scan = async () => {
          if (!barcodeDetectorRef.current || !videoRef.current) return;
          try {
            const barcodes = await barcodeDetectorRef.current.detect(videoRef.current);
            if (barcodes.length) {
              const code = barcodes[0].rawValue || "";
              const now = Date.now();
              if (now - lastDetectionTime > 2000) {
                setLastDetectionTime(now);
                setSuccess(true);
                setTimeout(() => {
                  stopScanning();
                  onDetected(code);
                  onClose();
                }, 800);
              }
            }
          } catch (err) {
            console.log("Scan error", err);
          }
          if (scanning) {
            animationRef.current = requestAnimationFrame(scan);
          }
        };

        animationRef.current = requestAnimationFrame(scan);
      } else {
        console.log("BarcodeDetector not supported, falling back to ZXing");
        const codeReader = new BrowserMultiFormatReader();
        scannerRef.current = codeReader;

        const controls = await codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result, error) => {
          if (result) {
            const now = Date.now();
            if (now - lastDetectionTime > 2000) {
              setLastDetectionTime(now);
              setSuccess(true);
              setTimeout(() => {
                stopScanning();
                onDetected(result.getText());
                onClose();
              }, 800);
            }
          }

          if (error && !(error instanceof NotFoundException)) {
            console.log("Scan error (non-critical):", error.message);
          }
        });

        controlsRef.current = controls;
      }
    } catch (err: any) {
      console.error("=== SCANNER ERROR ===", err);
      setScanning(false);

      let errorMessage = "שגיאה בהפעלת הסורק";

      if (err.name === "NotAllowedError") {
        errorMessage = "נדרשת הרשאה לגישה למצלמה. אנא אפשר גישה בדפדפן ונסה שוב.";
      } else if (err.name === "NotFoundError") {
        errorMessage = "לא נמצאה מצלמה במכשיר. בדוק שהמצלמה פועלת כראוי.";
      } else if (err.name === "NotReadableError") {
        errorMessage = "המצלמה בשימוש באפליקציה אחרת. סגור אפליקציות אחרות ונסה שוב.";
      } else if (err.message && err.message.includes("Permission")) {
        errorMessage = "נדרשת הרשאה לגישה למצלמה. בדוק הגדרות הדפדפן.";
      } else if (err.message && err.message.includes("constraints")) {
        errorMessage = "בעיה בהגדרות המצלמה. נסה לרענן את הדף.";
      }

      setError(errorMessage);
    }
  };

  React.useEffect(() => {
    if (open) {
      setTimeout(() => {
        startScanning();
      }, 100);
    } else {
      stopScanning();
    }
    
    return () => {
      stopScanning();
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>סרוק ברקוד - זיהוי מיידי</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center">
          {!error && (
            <div className="w-full min-h-80 bg-black rounded-lg flex items-center justify-center relative overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
              
              {/* Enhanced visual guidance frame */}
              {scanning && !success && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {/* Animated scanning frame */}
                  <div className="relative">
                    <div className="w-72 h-36 border-2 border-white border-dashed rounded-lg opacity-90 animate-pulse">
                      {/* Corner markers */}
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-lg animate-pulse"></div>
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-lg animate-pulse"></div>
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-lg animate-pulse"></div>
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-lg animate-pulse"></div>
                      
                      {/* Scanning line animation */}
                      <div className="absolute top-0 left-0 w-full h-1 bg-green-400 animate-[slide-down_2s_ease-in-out_infinite]" 
                           style={{
                             animation: 'slide-down 2s ease-in-out infinite',
                             backgroundImage: 'linear-gradient(90deg, transparent, #4ade80, transparent)'
                           }}></div>
                    </div>
                  </div>
                  
                  {/* Enhanced instructions */}
                  <div className="absolute text-white text-center bottom-4 bg-black bg-opacity-80 px-4 py-3 rounded-lg mx-4">
                    <div className="text-sm font-medium">📱 כוון את הברקוד למסגרת</div>
                    <div className="text-xs mt-1 opacity-90">🔍 זיהוי אוטומטי - ללא צורך בלחיצה</div>
                    <div className="text-xs mt-1 opacity-75">💡 וודא תאורה טובה למיקוד מושלם</div>
                  </div>
                </div>
              )}

              {/* Success animation - like Open Food Facts */}
              {success && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-green-600 bg-opacity-30">
                  <div className="text-center animate-scale-in">
                    <div className="text-7xl mb-3 animate-bounce">✅</div>
                    <div className="text-white text-xl font-bold drop-shadow-lg">ברקוד זוהה בהצלחה!</div>
                    <div className="text-green-200 text-sm mt-2">מעבד מידע...</div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {error && (
            <div className="w-full h-80 bg-black rounded-lg flex items-center justify-center">
              <div className="text-center px-6 py-4">
                <div className="text-5xl mb-4">⚠️</div>
                <div className="text-red-400 text-base font-medium leading-6 mb-4">{error}</div>
                <div className="text-gray-400 text-sm">
                  💡 טיפים לסריקה מושלמת:
                  <ul className="text-right mt-2 space-y-1 text-xs">
                    <li>• וודא תאורה טובה ויציבה</li>
                    <li>• החזק את המכשיר יציב</li>
                    <li>• נקה את עדשת המצלמה</li>
                    <li>• הצמד את הברקוד למסגרת הירוקה</li>
                    <li>• נסה זוויות שונות אם הברקוד מעוקם</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-3 text-xs text-gray-600 text-center">
            {error 
              ? "בדוק הרשאות מצלמה בדפדפן ונסה שוב" 
              : success
              ? "🎉 ברקוד זוהה בהצלחה - מעבד נתונים..."
              : scanning
              ? "🔍 מחפש ברקוד - זיהוי אוטומטי פעיל"
              : "🚀 מכין סורק ברקוד מתקדם עם זיהוי מיידי..."
            }
          </div>
        </div>
        
        <DialogFooter className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            סגור
          </Button>
          {error && (
            <Button variant="default" onClick={startScanning}>
              🔄 נסה שוב
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScannerDialog;
