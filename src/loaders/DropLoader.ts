import { AssetBundle } from './AssetBundle';

export async function bundleFromDropEvent(event: DragEvent): Promise<AssetBundle> {
  const items = event.dataTransfer?.items;
  if (items && items.length > 0) {
    const files = await readEntries(items);
    if (files.length > 0) {
      return AssetBundle.fromFileList(files);
    }
  }
  return AssetBundle.fromFileList(event.dataTransfer?.files ?? []);
}

async function readEntries(items: DataTransferItemList): Promise<File[]> {
  const files: File[] = [];
  const tasks: Promise<void>[] = [];
  for (const item of Array.from(items)) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) {
      tasks.push(readEntry(entry, '', files));
    } else {
      const file = item.getAsFile();
      if (file) {
        files.push(file);
      }
    }
  }
  await Promise.all(tasks);
  return files;
}

async function readEntry(entry: FileSystemEntry, prefix: string, output: File[]): Promise<void> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    const file = await new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject));
    Object.defineProperty(file, 'webkitRelativePath', {
      value: `${prefix}${file.name}`,
      configurable: true
    });
    output.push(file);
    return;
  }

  if (entry.isDirectory) {
    const dir = entry as FileSystemDirectoryEntry;
    const reader = dir.createReader();
    const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    await Promise.all(entries.map((child) => readEntry(child, `${prefix}${dir.name}/`, output)));
  }
}
