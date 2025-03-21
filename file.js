import { unlink } from "fs";
import { resolve } from "path";

export default function deleteFile(filePath) {
  const absolutePath = resolve(filePath);

  unlink(absolutePath, (err) => {
    if (err) {
      console.error(`Error deleting file: ${err.message}`);
      return;
    }
    console.log(`File deleted successfully: ${absolutePath}`);
  });
}

