import * as React from "react";
import { useGetDeliveryFiles, useRequestUploadUrl, useAttachDeliveryFile, useDeleteDeliveryFile, getGetDeliveryFilesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ObjectUploader } from "@workspace/object-storage-web";
import { Trash2, Download, FileText, FileImage, File, Loader2, Upload, Paperclip } from "lucide-react";
import type { UppyFile, UploadResult } from "@uppy/core";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return <FileImage className="w-4 h-4 text-blue-500" />;
  if (fileType === "application/pdf") return <FileText className="w-4 h-4 text-red-500" />;
  if (fileType.includes("word") || fileType.includes("document")) return <FileText className="w-4 h-4 text-blue-700" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getDownloadUrl(objectPath: string) {
  const stripped = objectPath.startsWith("/objects/")
    ? objectPath.replace("/objects", "")
    : "/" + objectPath.replace(/^\//, "");
  return `${BASE}/api/storage/objects${stripped}`;
}

interface DeliveryFilesProps {
  deliveryId: number;
  canDelete?: boolean;
}

export function DeliveryFiles({ deliveryId, canDelete = false }: DeliveryFilesProps) {
  const queryClient = useQueryClient();
  const uploadMap = React.useRef<Map<string, { objectPath: string; fileName: string; fileType: string; fileSize: number }>>(new Map());
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const { data: files = [], isLoading } = useGetDeliveryFiles(deliveryId);
  const requestUploadUrlMutation = useRequestUploadUrl();
  const attachFileMutation = useAttachDeliveryFile();
  const deleteFileMutation = useDeleteDeliveryFile();

  const handleGetUploadParameters = async (file: UppyFile<Record<string, unknown>, Record<string, unknown>>) => {
    setUploadError(null);
    const result = await requestUploadUrlMutation.mutateAsync({
      data: { name: file.name, size: file.size, contentType: file.type },
    });
    // Key by Uppy file ID — stable across the upload lifecycle, unlike the URL
    uploadMap.current.set(file.id, {
      objectPath: result.objectPath,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });
    return {
      method: "PUT" as const,
      url: result.uploadURL,
      headers: { "Content-Type": file.type },
    };
  };

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    for (const f of result.successful ?? []) {
      // Look up metadata by Uppy file ID (set during getUploadParameters)
      const meta = uploadMap.current.get(f.id);
      if (!meta) {
        console.warn("No upload metadata found for file", f.id, f.name);
        continue;
      }

      try {
        await attachFileMutation.mutateAsync({
          id: deliveryId,
          data: {
            fileName: meta.fileName,
            fileType: meta.fileType,
            fileSize: meta.fileSize,
            objectPath: meta.objectPath,
          },
        });
        uploadMap.current.delete(f.id);
        queryClient.invalidateQueries({ queryKey: getGetDeliveryFilesQueryKey(deliveryId) });
      } catch (e) {
        console.error("Failed to attach file", e);
        setUploadError("Upload succeeded but failed to save file record.");
      }
    }
  };

  const handleDelete = async (fileId: number) => {
    if (!window.confirm("Remove this file attachment?")) return;
    await deleteFileMutation.mutateAsync({ id: deliveryId, fileId });
    queryClient.invalidateQueries({ queryKey: getGetDeliveryFilesQueryKey(deliveryId) });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading files...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No files attached.</p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 bg-slate-50 rounded-md px-3 py-2 border border-border text-sm">
              {getFileIcon(f.fileType)}
              <span className="flex-1 font-medium truncate max-w-[180px]" title={f.fileName}>
                {f.fileName}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">{formatBytes(f.fileSize)}</span>
              <a
                href={getDownloadUrl(f.objectPath)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/70 shrink-0"
                title="Download / view"
              >
                <Download className="w-4 h-4" />
              </a>
              {canDelete && (
                <button
                  onClick={() => handleDelete(f.id)}
                  disabled={deleteFileMutation.isPending}
                  className="text-destructive hover:text-destructive/70 disabled:opacity-40 shrink-0"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}

      {canDelete && (
        <ObjectUploader
          maxNumberOfFiles={5}
          maxFileSize={20 * 1024 * 1024}
          onGetUploadParameters={handleGetUploadParameters}
          onComplete={handleUploadComplete}
          buttonClassName="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-border bg-white hover:bg-slate-50 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          Attach Files
        </ObjectUploader>
      )}
    </div>
  );
}

interface DeliveryFilesToggleProps {
  deliveryId: number;
  canDelete?: boolean;
}

export function DeliveryFilesToggle({ deliveryId, canDelete = false }: DeliveryFilesToggleProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
      >
        <Paperclip className="w-3 h-3" />
        {open ? "Hide files" : "Files"}
      </button>
      {open && (
        <div className="mt-2">
          <DeliveryFiles deliveryId={deliveryId} canDelete={canDelete} />
        </div>
      )}
    </div>
  );
}
