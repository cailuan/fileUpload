import path from 'path';
import fs, { WriteStream } from 'fs-extra';
export const TEMP_DIR = path.resolve(__dirname, 'temp');
export const PUBLIC_DIR = path.resolve(__dirname, 'public');
export const SIZE = 1024 * 1024 * 100;

export const splitChunks = async (filename: string, size: number = SIZE) => {
    const filePath = path.resolve(__dirname, filename);
    const chunksDir = path.resolve(TEMP_DIR, filename);
    let stat = await fs.stat(filePath);
    let content = await fs.readFile(filePath);
    let current = 0;
    let i = 0;
    await fs.mkdirp(chunksDir);
    while (current < stat.size) {
        await fs.writeFile(
            path.resolve(chunksDir, filename + '-' + i),
            content.slice(current, current + size)
        );
        i++;
        current += size;
    }
}
//splitChunks('dog.png', 1024  * 10);

const pipeStream = (filePath: string, writeStream: WriteStream) => new Promise(resolve => {
    const readStream = fs.createReadStream(filePath);
    readStream.on('end', async () => {
        await fs.unlink(filePath);
        resolve(true);
    });
    readStream.pipe(writeStream);
});
export const mergeChunks = async (filename: string, size: number = SIZE) => {
    const filePath = path.resolve(PUBLIC_DIR, filename);
    const chunksDir = path.resolve(TEMP_DIR, filename);
    const chunkFiles = await fs.readdir(chunksDir);
    chunkFiles.sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]));
    await Promise.all(
        chunkFiles.map((chunkFile, index) => pipeStream(
            path.resolve(chunksDir, chunkFile),
            fs.createWriteStream(filePath, {
                start: index * size
            })
        ))
    );
    await fs.rmdir(chunksDir);
}
