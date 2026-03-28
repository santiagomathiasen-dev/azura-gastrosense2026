import { useState, useRef, useEffect } from 'react';
import { Image, Video, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  name: string;
}

interface MediaUploadProps {
  media: MediaItem[];
  onMediaChange: (media: MediaItem[]) => void;
  maxItems?: number;
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function MediaUpload({ media, onMediaChange, maxItems = 5 }: MediaUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef(media);
  mediaRef.current = media;

  // Revoke all blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      mediaRef.current.forEach(item => {
        if (item.url.startsWith('blob:')) {
          URL.revokeObjectURL(item.url);
        }
      });
    };
  }, []);

  const validateFile = (file: File): boolean => {
    const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type);
    const isVideo = ACCEPTED_VIDEO_TYPES.includes(file.type);

    if (!isImage && !isVideo) {
      toast.error('Formato não suportado. Use JPG, PNG, WebP, GIF, MP4 ou WebM.');
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('Arquivo muito grande. Máximo 50MB.');
      return false;
    }

    return true;
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    const remainingSlots = maxItems - media.length;
    if (remainingSlots <= 0) {
      toast.error(`Máximo de ${maxItems} arquivos permitidos.`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    const newMedia: MediaItem[] = [];

    filesToProcess.forEach(file => {
      if (!validateFile(file)) return;

      const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type);
      const url = URL.createObjectURL(file);
      
      newMedia.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: isImage ? 'image' : 'video',
        url,
        name: file.name,
      });
    });

    if (newMedia.length > 0) {
      onMediaChange([...media, ...newMedia]);
      toast.success(`${newMedia.length} arquivo(s) adicionado(s)`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleRemove = (id: string) => {
    const item = media.find(m => m.id === id);
    if (item?.url.startsWith('blob:')) {
      URL.revokeObjectURL(item.url);
    }
    onMediaChange(media.filter(m => m.id !== id));
  };

  return (
    <div className="space-y-3">
      {/* Upload area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={[...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(',')}
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Arraste fotos ou vídeos aqui ou clique para selecionar
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          JPG, PNG, WebP, GIF, MP4, WebM (máx. 50MB)
        </p>
      </div>

      {/* Media preview grid */}
      {media.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {media.map((item) => (
            <div key={item.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
              {item.type === 'image' ? (
                <img 
                  src={item.url} 
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="relative w-full h-full">
                  <video 
                    src={item.url}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Video className="h-8 w-8 text-white" />
                  </div>
                </div>
              )}
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(item.id);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                {item.type === 'image' ? (
                  <Image className="h-3 w-3 text-white inline mr-1" />
                ) : (
                  <Video className="h-3 w-3 text-white inline mr-1" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type { MediaItem };
