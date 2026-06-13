import { useState } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import AwsS3 from "@uppy/aws-s3";
import type { UploadResult } from "@uppy/core";
import { Button } from "@/components/ui/button";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  accept?: string;
  onGetUploadParameters: (file?: File) => Promise<{
    method: "PUT";
    url: string;
    metadata?: Record<string, unknown>;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  buttonClassName?: string;
  children: ReactNode;
}

export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 104857600,
  allowedFileTypes = ['video/*'],
  accept = "video/*",
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
        allowedFileTypes,
      },
      autoProceed: false,
    })
      .use(AwsS3, {
        shouldUseMultipart: false,
        getUploadParameters: async (file) => {
          const params = await onGetUploadParameters(file.data as File);
          if (params.metadata) {
            Object.entries(params.metadata).forEach(([key, value]) => {
              file.meta[key] = value;
            });
          }
          return {
            method: params.method,
            url: params.url,
          };
        },
      })
      .on("complete", (result) => {
        onComplete?.(result);
      })
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    uppy.addFile({
      name: file.name,
      type: file.type,
      data: file,
    });

    uppy.upload();
  };

  return (
    <div>
      <input
        type="file"
        id="file-input"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />
      <Button
        onClick={() => document.getElementById("file-input")?.click()}
        className={buttonClassName}
        data-testid="button-upload"
      >
        {children}
      </Button>
    </div>
  );
}
