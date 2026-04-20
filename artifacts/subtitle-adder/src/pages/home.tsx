import React, { useState, useRef } from "react";
import { Upload, Film, Settings2, Play, Download, FileVideo, ChevronLeft, Languages, Type, PanelBottom } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

type AppState = "upload" | "configure" | "processing" | "download";
type SubtitleColor = "white" | "yellow";
type SubtitleBackground = "yes" | "no";
type SubtitleSize = "normal" | "large";
type TranslateMode = "original" | "english";

export default function Home() {
  const [state, setState] = useState<AppState>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [color, setColor] = useState<SubtitleColor>("white");
  const [background, setBackground] = useState<SubtitleBackground>("yes");
  const [size, setSize] = useState<SubtitleSize>("normal");
  const [translate, setTranslate] = useState<TranslateMode>("original");
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [resultUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type.startsWith("video/")) {
      setFile(selected);
      setState("configure");
    } else if (selected) {
      toast({ title: "Invalid file", description: "Please upload a video file.", variant: "destructive" });
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type.startsWith("video/")) {
      setFile(dropped);
      setState("configure");
    } else if (dropped) {
      toast({ title: "Invalid file", description: "Please drop a video file.", variant: "destructive" });
    }
  };

  const handleProcess = () => {
    if (!file) return;
    setState("processing");
    setProgress(0);

    const formData = new FormData();
    formData.append("video", file);
    formData.append("color", color);
    formData.append("background", background);
    formData.append("size", size);
    formData.append("translate", translate);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/subtitles/process", true);
    xhr.responseType = "blob";

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress((e.loaded / e.total) * 45);
      }
    };

    xhr.upload.onload = () => {
      let current = 45;
      progressIntervalRef.current = setInterval(() => {
        current += Math.random() * 3;
        if (current >= 94) {
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          current = 94;
        }
        setProgress(current);
      }, 800);
    };

    xhr.onload = () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (xhr.status >= 200 && xhr.status < 300) {
        setProgress(100);
        const url = URL.createObjectURL(xhr.response);
        setResultUrl(url);
        setTimeout(() => setState("download"), 500);
      } else {
        setState("configure");
        toast({ title: "Processing Failed", description: "An error occurred while adding subtitles. Please try again.", variant: "destructive" });
      }
    };

    xhr.onerror = () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setState("configure");
      toast({ title: "Network Error", description: "Failed to communicate with the server. Please check your connection.", variant: "destructive" });
    };

    xhr.send(formData);
  };

  const handleReset = () => {
    if (resultUrl) { URL.revokeObjectURL(resultUrl); setResultUrl(null); }
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setFile(null);
    setProgress(0);
    setState("upload");
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-8 bg-background relative overflow-hidden text-foreground">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none opacity-50" />

      <div className="w-full max-w-md z-10 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Studio Subtitles</h1>
          <p className="text-muted-foreground text-sm">Professional AI-powered closed captions</p>
        </div>

        {/* UPLOAD STATE */}
        {state === "upload" && (
          <Card className="border-border bg-card/50 backdrop-blur-sm shadow-2xl">
            <CardContent className="pt-6">
              <div
                className={`relative group cursor-pointer rounded-lg border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center py-16 px-4 text-center ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleFileChange} />
                <div className="bg-background/80 p-4 rounded-full mb-4 shadow-sm border border-border group-hover:scale-110 transition-transform duration-300">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Upload Video Sequence</h3>
                <p className="text-muted-foreground text-sm max-w-[250px]">
                  Drag and drop your footage here, or click to browse
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CONFIGURE STATE */}
        {state === "configure" && file && (
          <Card className="border-border bg-card/50 backdrop-blur-sm shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full -ml-2" onClick={handleReset}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg">Subtitle Settings</CardTitle>
                  <CardDescription className="flex items-center gap-1.5 truncate">
                    <Film className="w-3 h-3 shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Language / Translation */}
              <OptionGroup icon={<Languages className="w-3.5 h-3.5" />} label="Language">
                <RadioGroup value={translate} onValueChange={(v) => setTranslate(v as TranslateMode)} className="flex gap-3">
                  <OptionCard id="translate-original" value="original" current={translate}>
                    <span className="font-semibold text-sm">Keep Original</span>
                    <span className="text-xs text-muted-foreground mt-0.5">Subtitles in spoken language</span>
                  </OptionCard>
                  <OptionCard id="translate-english" value="english" current={translate}>
                    <span className="font-semibold text-sm">Translate to English</span>
                    <span className="text-xs text-muted-foreground mt-0.5">Auto-translate any language</span>
                  </OptionCard>
                </RadioGroup>
              </OptionGroup>

              {/* Color */}
              <OptionGroup icon={<span className="w-3 h-3 rounded-full bg-foreground inline-block" />} label="Color">
                <RadioGroup value={color} onValueChange={(v) => setColor(v as SubtitleColor)} className="flex gap-3">
                  <OptionCard id="color-white" value="white" current={color}>
                    <span className="text-lg font-bold text-white drop-shadow">White</span>
                    <span className="text-xs text-muted-foreground mt-0.5">Standard</span>
                  </OptionCard>
                  <OptionCard id="color-yellow" value="yellow" current={color}>
                    <span className="text-lg font-bold text-yellow-400">Yellow</span>
                    <span className="text-xs text-muted-foreground mt-0.5">Cinematic</span>
                  </OptionCard>
                </RadioGroup>
              </OptionGroup>

              {/* Background */}
              <OptionGroup icon={<PanelBottom className="w-3.5 h-3.5" />} label="Background">
                <RadioGroup value={background} onValueChange={(v) => setBackground(v as SubtitleBackground)} className="flex gap-3">
                  <OptionCard id="bg-yes" value="yes" current={background}>
                    <span className="text-sm font-semibold">With Background</span>
                    <span className="text-xs text-muted-foreground mt-0.5">Dark box behind text</span>
                  </OptionCard>
                  <OptionCard id="bg-no" value="no" current={background}>
                    <span className="text-sm font-semibold">No Background</span>
                    <span className="text-xs text-muted-foreground mt-0.5">Outline only</span>
                  </OptionCard>
                </RadioGroup>
              </OptionGroup>

              {/* Size */}
              <OptionGroup icon={<Type className="w-3.5 h-3.5" />} label="Size">
                <RadioGroup value={size} onValueChange={(v) => setSize(v as SubtitleSize)} className="flex gap-3">
                  <OptionCard id="size-normal" value="normal" current={size}>
                    <span className="text-sm font-semibold">Normal</span>
                    <span className="text-xs text-muted-foreground mt-0.5">Standard size</span>
                  </OptionCard>
                  <OptionCard id="size-large" value="large" current={size}>
                    <span className="text-base font-semibold">Large</span>
                    <span className="text-xs text-muted-foreground mt-0.5">Bigger text</span>
                  </OptionCard>
                </RadioGroup>
              </OptionGroup>
            </CardContent>

            <CardFooter>
              <Button onClick={handleProcess} className="w-full h-12 text-base font-semibold" size="lg">
                <Settings2 className="w-5 h-5 mr-2" />
                Render Subtitles
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* PROCESSING STATE */}
        {state === "processing" && (
          <Card className="border-border bg-card/50 backdrop-blur-sm shadow-2xl animate-in fade-in zoom-in-95 duration-500 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-muted">
              <div className="h-full bg-primary transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <CardContent className="pt-12 pb-10 flex flex-col items-center justify-center text-center space-y-8">
              <div className="flex items-center justify-center gap-1 h-12 w-full">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 bg-primary rounded-full animate-waveform delay-${(i % 5) * 100}`}
                    style={{ height: `${Math.max(20, Math.random() * 100)}%` }}
                  />
                ))}
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-lg tracking-tight">Processing Sequence</h3>
                <p className="text-muted-foreground text-sm max-w-[250px] mx-auto animate-pulse">
                  {progress < 45 ? "Uploading footage..." :
                   progress < 70 ? "Transcribing audio..." :
                   progress < 88 ? (translate === "english" ? "Translating to English..." : "Building subtitles...") :
                   "Rendering final video..."}
                </p>
              </div>
              <div className="text-3xl font-mono font-bold text-primary/80">
                {Math.round(progress)}%
              </div>
            </CardContent>
          </Card>
        )}

        {/* DOWNLOAD STATE */}
        {state === "download" && resultUrl && (
          <Card className="border-primary/50 bg-card/50 backdrop-blur-sm shadow-2xl shadow-primary/10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto bg-green-500/10 text-green-500 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <Play className="w-8 h-8 ml-1" />
              </div>
              <CardTitle className="text-2xl">Render Complete</CardTitle>
              <CardDescription>Your sequence is ready for distribution</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6 pt-6">
              <div className="flex items-center gap-3 p-4 bg-background/50 rounded-lg border border-border w-full">
                <FileVideo className="w-8 h-8 text-primary shrink-0" />
                <div className="flex-1 overflow-hidden">
                  <p className="font-medium truncate">{file?.name.replace(/\.[^/.]+$/, "")}_subtitled.mp4</p>
                  <p className="text-xs text-muted-foreground">
                    MP4 &bull; {color === "yellow" ? "Yellow" : "White"} &bull; {size === "large" ? "Large" : "Normal"} &bull; {background === "yes" ? "Background" : "No background"}{translate === "english" ? " &bull; English" : ""}
                  </p>
                </div>
              </div>
              <Button asChild className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20" size="lg">
                <a href={resultUrl} download={`${file?.name.replace(/\.[^/.]+$/, "")}_subtitled.mp4`}>
                  <Download className="w-5 h-5 mr-2" />
                  Download Video
                </a>
              </Button>
              <Button variant="ghost" onClick={handleReset} className="w-full text-muted-foreground hover:text-foreground">
                Process another video
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function OptionGroup({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">{icon}</span>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</Label>
      </div>
      {children}
    </div>
  );
}

function OptionCard({ id, value, current, children }: { id: string; value: string; current: string; children: React.ReactNode }) {
  return (
    <div className="flex-1">
      <RadioGroupItem value={value} id={id} className="peer sr-only" />
      <Label
        htmlFor={id}
        className="flex flex-col items-center justify-center p-3 border rounded-md cursor-pointer hover:bg-muted/30 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all text-center"
      >
        {children}
      </Label>
    </div>
  );
}
