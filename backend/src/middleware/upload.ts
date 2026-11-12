import multer from "multer";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";
import { ALLOWED_UPLOAD_MIMES } from "../storage/index";

const MAX_FILE_SIZE = env.maxUploadMb * 1024 * 1024;

const storage = multer.memoryStorage();

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ok = ALLOWED_UPLOAD_MIMES.has(file.mimetype) && /\.(pdf|doc|docx|txt|jpe?g|png|webp)$/i.test(file.originalname);
  if (!ok) {
    return cb(
      ApiError.badRequest(
        "Unsupported file type. Allowed: PDF, DOCX, TXT, JPG, PNG.",
        { allowedMimes: Array.from(ALLOWED_UPLOAD_MIMES) },
      ),
    );
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 5 },
  fileFilter,
});

const CV_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const cvFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ok = CV_MIMES.has(file.mimetype) && /\.(pdf|doc|docx)$/i.test(file.originalname);
  if (!ok) {
    return cb(ApiError.badRequest("Unsupported file type. Only PDF, DOC and DOCX are allowed."));
  }
  cb(null, true);
};

/** CV-only upload: PDF, DOC, DOCX, single file, size capped like other uploads. */
export const cvUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: cvFilter,
});

export function validateUploadedFile(file: Express.Multer.File | undefined, required = false) {
  if (!file) {
    if (required) throw ApiError.badRequest("File is required.");
    return undefined;
  }
  if (!ALLOWED_UPLOAD_MIMES.has(file.mimetype)) {
    throw ApiError.badRequest("Unsupported file type.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw ApiError.badRequest(`File too large. Maximum ${env.maxUploadMb} MB.`);
  }
  return file;
}
