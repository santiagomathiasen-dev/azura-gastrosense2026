import { useState, useRef } from 'react';
import Image from 'next/image';
import { Camera, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImageUploadProps {
  currentImageUrl?: string | null;
  onImageUploaded: (url: string) => void;
  onImageRemoved: () => void;
  bucket: string;
  folder?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ImageUpload({
  currentImageUrl,
  onImageUploaded,
  onImageRemoved,
  bucket,
  folder = '',
  className = '',
  size = 'md',
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 5MB.');
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      onImageUploaded(publicUrl);
      toast.success('Imagem enviada com sucesso!');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Erro ao enviar imagem');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    onImageRemoved();
  };

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        className="hidden"
      />

      {currentImageUrl ? (
        <div className="relative w-full h-full rounded-lg overflow-hidden border">
          <Image
            src={currentImageUrl}
            alt="Imagem"
            fill
            className="object-cover"
            sizes="128px"
            unoptimized={!currentImageUrl.startsWith('https://')}
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-0 right-0 h-5 w-5 rounded-bl-lg rounded-tr-lg"
            onClick={handleRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className={`w-full h-full flex flex-col items-center justify-center gap-1 ${uploading ? 'opacity-50' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Camera className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Foto</span>
            </>
          )}
        </Button>
      )}
    </div>
  );
}
