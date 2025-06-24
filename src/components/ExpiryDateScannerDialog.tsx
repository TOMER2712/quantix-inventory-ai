
import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import Tesseract from 'tesseract.js';

interface ExpiryDateScannerDialogProps {
  open: boolean;
  onClose: () => void;
  onDetected: (scannedDate: string) => void;
}

const ExpiryDateScannerDialog: React.FC<ExpiryDateScannerDialogProps> = ({
  open,
  onClose,
  onDetected,
}) => {
  const [isScanning, setIsScanning] = React.useState(false);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לגשת למצלמה",
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsScanning(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    try {
      const { data: { text } } = await Tesseract.recognize(canvas, 'eng');
      console.log('OCR Text:', text);

      const datePatterns = [
        /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/g, // dd/mm/yyyy או dd-mm-yyyy או dd.mm.yyyy
        /\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/g  // yyyy-mm-dd או yyyy/mm/dd
      ];

      const foundDates: string[] = [];

      datePatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          let dateStr = '';
          if (pattern.source.includes('(\\d{4})')) {
            // yyyy-mm-dd format
            const year = match[1];
            const month = match[2].padStart(2, '0');
            const day = match[3].padStart(2, '0');
            dateStr = `${year}-${month}-${day}`;
          } else {
            // dd/mm/yyyy format
            const day = match[1].padStart(2, '0');
            const month = match[2].padStart(2, '0');
            const year = match[3];
            dateStr = `${year}-${month}-${day}`;
          }
          
          // בדיקה שהתאריך תקין
          const date = new Date(dateStr);
          if (!isNaN(date.getTime()) && date.getFullYear() > 2020 && date.getFullYear() < 2050) {
            foundDates.push(dateStr);
          }
        }
      });

      if (foundDates.length === 0) {
        toast({
          title: "לא זוהה תאריך תקף",
          description: "נא להזין ידנית",
          variant: "destructive"
        });
      } else if (foundDates.length === 1) {
        onDetected(foundDates[0]);
        onClose();
        toast({
          title: "תאריך נסרק בהצלחה!",
          description: `זוהה: ${foundDates[0]}`
        });
      } else {
        // מספר תאריכים - נבחר את הראשון לעת עתה
        onDetected(foundDates[0]);
        onClose();
        toast({
          title: "זוהו מספר תאריכים",
          description: `נבחר: ${foundDates[0]}`
        });
      }
    } catch (error) {
      console.error('OCR Error:', error);
      toast({
        title: "שגיאה בסריקה",
        description: "נא לנסות שוב או להזין ידנית",
        variant: "destructive"
      });
    } finally {
      setIsScanning(false);
    }
  };

  React.useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            סריקת תאריך תפוגה
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {stream && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-4 border-2 border-white/50 rounded-lg">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white"></div>
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white"></div>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white"></div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white"></div>
                </div>
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded text-sm">
                  מקד על תאריך התפוגה
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={captureAndScan}
              disabled={!stream || isScanning}
              className="flex-1"
            >
              {isScanning ? "סורק..." : "סרוק תאריך"}
            </Button>
            <Button variant="outline" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="text-sm text-muted-foreground text-center">
            המערכת מחפשת תאריכים בפורמטים: dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExpiryDateScannerDialog;
