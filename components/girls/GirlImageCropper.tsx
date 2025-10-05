"use client";

import { useState, useRef, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface GirlImageCropperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageFile: File | null;
  onCropComplete: (croppedBlob: Blob) => void;
  title?: string;
}

// 裁剪比例选项
const ASPECT_RATIO_OPTIONS = [
  { value: '3:4', label: '3:4 (竖版)', ratio: 3 / 4 },
  { value: '1:1', label: '1:1 (方形)', ratio: 1 },
  { value: '9:16', label: '9:16 (超竖)', ratio: 9 / 16 },
];

export function GirlImageCropper({ 
  open, 
  onOpenChange, 
  imageFile, 
  onCropComplete,
  title = "裁剪头像"
}: GirlImageCropperProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number>(3 / 4); // 默认 3:4
  const imgRef = useRef<HTMLImageElement>(null);
  
  // 当图片文件改变时，创建对应的URL
  useEffect(() => {
    if (imageFile) {
      const objectUrl = URL.createObjectURL(imageFile);
      setImageUrl(objectUrl);
      
      // 清理函数，组件卸载时释放URL
      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    }
  }, [imageFile]);
  
  // 当图片加载或比例改变时设置裁剪区域
  const updateCropArea = (width: number, height: number) => {
    const newCrop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        aspectRatio,
        width,
        height
      ),
      width,
      height
    );
    setCrop(newCrop);
  };

  // 当图片加载时设置初始裁剪区域
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    updateCropArea(width, height);
  };

  // 当比例改变时更新裁剪区域
  useEffect(() => {
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      updateCropArea(width, height);
    }
  }, [aspectRatio]);

  // 保存裁剪后的图像（不压缩质量）
  const handleSave = () => {
    if (completedCrop?.width && completedCrop?.height && imgRef.current) {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          console.error("Failed to get canvas context");
          return;
        }
        
        const image = imgRef.current;
        
        // 设置Canvas尺寸
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
        
        const pixelRatio = window.devicePixelRatio || 1;
        const canvasWidth = completedCrop.width;
        const canvasHeight = completedCrop.height;
        
        canvas.width = canvasWidth * pixelRatio;
        canvas.height = canvasHeight * pixelRatio;
        
        ctx.scale(pixelRatio, pixelRatio);
        ctx.imageSmoothingQuality = 'high';
        
        // 应用旋转和缩放
        ctx.save();
        ctx.translate(canvasWidth / 2, canvasHeight / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(scale, scale);
        ctx.translate(-canvasWidth / 2, -canvasHeight / 2);
        
        // 绘制裁剪区域
        ctx.drawImage(
          image,
          completedCrop.x * scaleX,
          completedCrop.y * scaleY,
          completedCrop.width * scaleX,
          completedCrop.height * scaleY,
          0,
          0,
          canvasWidth,
          canvasHeight
        );
        
        ctx.restore();
        
        // 将Canvas转换为Blob（质量设置为1.0，不压缩）
        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log("裁剪成功: 生成图像大小", blob.size, "bytes");
              onCropComplete(blob);
              onOpenChange(false);
            } else {
              console.error("裁剪失败: 无法生成blob");
            }
          },
          'image/jpeg',
          1.0 // 质量参数设置为1.0，保持原图质量
        );
      } catch (error) {
        console.error("裁剪过程中出错:", error);
      }
    } else {
      console.error("裁剪失败: 缺少必要参数", {
        hasCompletedCrop: !!completedCrop,
        cropWidth: completedCrop?.width,
        cropHeight: completedCrop?.height,
        hasImgRef: !!imgRef.current
      });
    }
  };

  // 重置裁剪区域
  const handleReset = () => {
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      updateCropArea(width, height);
      setRotation(0);
      setScale(1);
    }
  };

  // 旋转图片
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // 缩放图片
  const handleScale = (newScale: number[]) => {
    setScale(newScale[0]);
  };

  // 缩放增减
  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.1, 0.5));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-4">
          {/* 比例选择 */}
          <div className="w-full">
            <label className="text-sm font-medium mb-2 block">裁剪比例</label>
            <ToggleGroup 
              type="single" 
              value={ASPECT_RATIO_OPTIONS.find(opt => opt.ratio === aspectRatio)?.value || '3:4'}
              onValueChange={(value) => {
                const option = ASPECT_RATIO_OPTIONS.find(opt => opt.value === value);
                if (option) {
                  setAspectRatio(option.ratio);
                }
              }}
              className="justify-start"
            >
              {ASPECT_RATIO_OPTIONS.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value} className="flex-1">
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {imageUrl && (
            <div className="relative border rounded-md overflow-hidden">
              <ReactCrop
                crop={crop}
                onChange={(c: Crop) => setCrop(c)}
                onComplete={(c: PixelCrop) => setCompletedCrop(c)}
                aspect={aspectRatio}
                className="max-h-[400px] overflow-auto"
              >
                <img
                  ref={imgRef}
                  src={imageUrl}
                  alt="待裁剪图片"
                  style={{ 
                    transform: `scale(${scale}) rotate(${rotation}deg)`,
                    maxHeight: '400px',
                    transition: 'transform 0.3s'
                  }}
                  onLoad={onImageLoad}
                />
              </ReactCrop>
            </div>
          )}

          <div className="flex items-center space-x-4 w-full max-w-md">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleZoomOut} 
              disabled={scale <= 0.5}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            
            <div className="flex-1">
              <Slider 
                value={[scale]} 
                min={0.5} 
                max={3} 
                step={0.01} 
                onValueChange={handleScale} 
              />
            </div>
            
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleZoomIn} 
              disabled={scale >= 3}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>

            <Button 
              variant="outline" 
              size="icon"
              onClick={handleRotate}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReset}>重置</Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave}>确认裁剪</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

