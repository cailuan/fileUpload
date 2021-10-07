import createError from 'http-errors';
import express, { Request, Response, NextFunction } from 'express';
import logger from 'morgan';
import { INTERNAL_SERVER_ERROR } from 'http-status-codes';
import cors from 'cors';
import path from 'path';
import { TEMP_DIR, PUBLIC_DIR, mergeChunks } from './utils';
import fs from 'fs-extra';
import multiparty from 'multiparty';
let app = express();
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(express.static(path.resolve(__dirname, 'public')));
app.post('/merge', async (req: Request, res: Response) => {
    let { filename } = req.body;
    await mergeChunks(filename);
    res.json({
        success: true,
        url: `http://localhost:8000/${filename}`
    });
});
 app.post('/upload/:filename/:chunk_name/:start', async (req: Request, res: Response, _next: NextFunction) => {
    let start = isNaN(Number(req.params.start)) ? 0 : Number(req.params.start);
    let file_dir = path.resolve(TEMP_DIR, req.params.filename);
    let exist = await fs.pathExists(file_dir);
    if (!exist) {
        await fs.mkdirs(file_dir);
    }
    console.log(req,"req")
    const filePath = path.resolve(TEMP_DIR, req.params.filename, req.params.chunk_name);
         let writeStream = fs.createWriteStream(filePath, { start, flags: "a" });
    req.pipe(writeStream);
         req.on('error', () => {
                 writeStream.close();
             });
         req.on('close', () => {
                 writeStream.close();
             });
    req.on('end', () => {
        writeStream.close();
        res.json({
            success: true
        });
    });
});
 app.post('/verify', async (req: Request, res: Response): Promise<any> => {
         const { filename } = req.body;
         const filePath = path.resolve(PUBLIC_DIR, filename);
         let existFile = await fs.pathExists(filePath);
         if (existFile) {
                 return res.json({
                         success: true,
                         needUpload: false
                 });
             }
         let tempFilePath = path.resolve(TEMP_DIR, filename);
         let uploadedList: any[] = [];
         let existTemporaryFile = await fs.pathExists(tempFilePath);
         if (existTemporaryFile) {
                 uploadedList = await fs.readdir(tempFilePath);
                 uploadedList = await Promise.all(uploadedList.map(async (filename: string) => {
                         let stat = await fs.stat(path.resolve(tempFilePath, filename));
                         return {
                             filename,
                                 size: stat.size
                         }
                     }));
             }
         res.json({
                 success: true,
                 needUpload: true,
                 uploadedList: uploadedList
         });
     });
app.post('/upload', async (req: Request, res: Response, next: NextFunction) => {
    let form = new multiparty.Form();
    form.parse(req, async (err, fields, files) => {
        if (err) {
            return next(err);
        }
        let [filename] = fields.filename;
        let [chunk] = files.chunk;
        await fs.move(chunk.path, path.resolve(PUBLIC_DIR, filename), { overwrite: true });
        setTimeout(() => {
            res.json({
                success: true
            });
        }, 3000);
    });
});
app.use(function (_req, _res, next) {
    next(createError(404));
});

app.use(function (error: any, _req: Request, res: Response, _next: NextFunction) {
    res.status(error.status || INTERNAL_SERVER_ERROR);
    res.json({
        success: false,
        error
    });
});

export default app;
