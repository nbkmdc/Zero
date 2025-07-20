import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Settings, Image, FileImage, Zap } from 'lucide-react';
import type { ImageQuality } from '@/lib/image-compression';

import { Label } from '@/components/ui/label';

interface ImageCompressionSettingsProps {
  quality: ImageQuality;
  onQualityChange: (quality: ImageQuality) => void;
  className?: string;
}

const qualityOptions = [
  {
    value: 'low' as const,
    icon: Zap,
    color: 'text-green-600',
  },
  {
    value: 'medium' as const,
    icon: Image,
    color: 'text-blue-600',
  },
  {
    value: 'original' as const,
    icon: FileImage,
    color: 'text-purple-600',
  },
];

export function ImageCompressionSettings({
  quality,
  onQualityChange,
  className,
}: ImageCompressionSettingsProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          <CardTitle className="text-sm font-medium">
            Image Compression
          </CardTitle>
        </div>
        <CardDescription className="text-xs">
          Choose image quality for attachments
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <RadioGroup
          value={quality}
          onValueChange={(value) => onQualityChange(value as ImageQuality)}
        >
          <div className="space-y-3">
            {qualityOptions.map((option) => {
              const Icon = option.icon;
              return (
                <div key={option.value} className="flex items-center space-x-3">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${option.color}`} />
                    <div className="flex flex-col">
                      <Label htmlFor={option.value} className="cursor-pointer text-sm font-medium">
                        {option.value === 'low' ? 'Low Quality' : option.value === 'medium' ? 'Medium Quality' : 'Original Quality'}
                      </Label>
                      <span className="text-muted-foreground text-xs">
                        {option.value === 'low' ? 'Smaller file size, faster upload' : option.value === 'medium' ? 'Balanced quality and size' : 'Best quality, larger file size'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
