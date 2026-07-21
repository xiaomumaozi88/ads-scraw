import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 必须在读取 process.env 的业务模块之前加载（ESM import 顺序）
dotenv.config({ path: join(__dirname, '..', '.env') });
