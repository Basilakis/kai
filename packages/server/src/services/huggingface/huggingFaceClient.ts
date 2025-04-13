/**
 * Fully unified huggingFaceClient.ts
 * Combines HuggingFaceClient class and extension-based methods (dataset operations etc.)
 * ensuring we have a single cohesive HuggingFace integration.
 */

import { HfInference } from '@huggingface/inference';
import { HfFolder, whoAmI } from '@huggingface/hub';
import axios from 'axios';
import { logger } from '../../utils/logger';

/**
 * Hugging Face config interface
 */
export interface HuggingFaceConfig {
  apiKey?: string;
  apiUrl?: string;
  timeout?: number;
  retries?: number;
  organizationId?: string;
}

/**
 * Basic user info
 */
export interface HuggingFaceUser {
  id: string;
  name?: string;
  email?: string;
  organizationIds?: string[];
}

/**
 * Hugging Face Client Core
 */
class HuggingFaceClientCore {
  private config: HuggingFaceConfig = {
    apiKey: process.env.HF_API_KEY,
    apiUrl: 'https://huggingface.co/api',
    timeout: 30000,
    retries: 3,
    organizationId: process.env.HF_ORGANIZATION_ID
  };

  private inferenceClient: HfInference | null = null;
  private apiKey: string | null = null;
  private initialized: boolean = false;

  constructor() {
    // If there's an API key from environment, initialize automatically
    if (this.config.apiKey) {
      this.init({ apiKey: this.config.apiKey });
    }
  }

  public init(cfg: HuggingFaceConfig): void {
    if (this.initialized) {
      logger.warn('Hugging Face client already initialized');
      return;
    }
    this.config = {
      ...this.config,
      ...cfg
    };
    this.apiKey = this.config.apiKey || HfFolder.getToken();
    if (!this.apiKey) {
      logger.warn('No Hugging Face API key provided; operations may be limited.');
    } else {
      this.inferenceClient = new HfInference(this.apiKey);
      logger.info('Hugging Face inference client initialized');
    }
    this.initialized = true;
    logger.info('Hugging Face client core initialized');
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public getInferenceClient(): HfInference {
    if (!this.inferenceClient) {
      if (!this.apiKey) {
        throw new Error('API key required for inference client');
      }
      this.inferenceClient = new HfInference(this.apiKey);
    }
    return this.inferenceClient;
  }

  public async getCurrentUser(): Promise<HuggingFaceUser | null> {
    try {
      if (!this.apiKey) {
        return null;
      }
      const userInfo = await whoAmI({ token: this.apiKey });
      if (!userInfo || !userInfo.name) {
        return null;
      }
      return {
        id: userInfo.name,
        name: userInfo.fullname || userInfo.name,
        email: userInfo.email,
        organizationIds: userInfo.orgs
      };
    } catch (err) {
      logger.error(`Failed to get user info: ${err}`);
      return null;
    }
  }

  public async createDatasetRepository(options: {
    name: string;
    visibility?: 'private' | 'public' | 'organization';
    description?: string;
    organization?: string;
  }): Promise<string | null> {
    try {
      if (!this.apiKey) {
        throw new Error('API key required to create dataset repository');
      }
      const repoName = options.name.toLowerCase().replace(/\s+/g, '-');
      const orgId = options.organization || this.config.organizationId;
      const repoId = orgId ? `${orgId}/${repoName}` : repoName;
      const response = await axios({
        method: 'POST',
        url: `${this.config.apiUrl}/datasets/create`,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: repoName,
          organization: orgId,
          private: options.visibility !== 'public',
          description: options.description || '',
          tags: [],
          license: 'mit'
        },
        timeout: this.config.timeout
      });
      if (response.status === 200) {
        logger.info(`Created Hugging Face dataset repository: ${repoId}`);
        return repoId;
      } else {
        logger.error(`Failed to create dataset repository: ${response.statusText}`);
        return null;
      }
    } catch (err) {
      logger.error(`Error creating dataset repository: ${err}`);
      return null;
    }
  }

  public async uploadFile(
    repoId: string,
    filePath: string,
    content: any,
    commitMessage: string
  ): Promise<boolean> {
    try {
      if (!this.apiKey) {
        throw new Error('API key required to upload files');
      }
      let fileContent: any;
      let contentType: string;
      if (content && typeof content === 'object' && 'buffer' in content) {
        fileContent = content;
        contentType = 'application/octet-stream';
      } else if (typeof content === 'string') {
        fileContent = content;
        contentType = 'text/plain';
      } else {
        fileContent = JSON.stringify(content, null, 2);
        contentType = 'application/json';
      }
      const response = await axios({
        method: 'POST',
        url: `${this.config.apiUrl}/datasets/${repoId}/upload/${filePath}`,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': contentType
        },
        data: fileContent,
        params: {
          commit_message: commitMessage
        },
        timeout: this.config.timeout
      });
      if (response.status === 200) {
        logger.info(`Uploaded file to ${repoId}/${filePath}`);
        return true;
      } else {
        logger.error(`Failed to upload file: ${response.statusText}`);
        return false;
      }
    } catch (err) {
      logger.error(`Error uploading file: ${err}`);
      return false;
    }
  }

  public async downloadFile(
    repoId: string,
    filePath: string,
    revision: string = 'main'
  ): Promise<any> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }
      const response = await axios({
        method: 'GET',
        url: `${this.config.apiUrl}/datasets/${repoId}/resolve/${revision}/${filePath}`,
        headers,
        responseType: 'arraybuffer',
        timeout: this.config.timeout
      });
      if (response.status === 200) {
        return response.data;
      } else {
        logger.error(`Failed to download file: ${response.statusText}`);
        return null;
      }
    } catch (err) {
      logger.error(`Error downloading file: ${err}`);
      return null;
    }
  }

  public async searchDatasets(options: {
    query?: string;
    author?: string;
    tag?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    datasets: Array<{ id: string; name: string; description?: string; author: string; tags: string[]; downloads: number; likes: number; lastModified: Date }>;
  }> {
    try {
      const {
        query = '',
        author = '',
        tag = '',
        limit = 10,
        offset = 0
      } = options;
      const params: Record<string, string | number> = { limit, offset };
      if (query) params.search = query;
      if (author) params.author = author;
      if (tag) params.tag = tag;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }
      const response = await axios({
        method: 'GET',
        url: `${this.config.apiUrl}/datasets`,
        headers,
        params,
        timeout: this.config.timeout
      });
      if (response.status === 200) {
        const results = {
          datasets: (response.data || []).map((item: any) => ({
            id: item.id,
            name: item.name || item.id.split('/').pop(),
            description: item.description || '',
            author: item.author || '',
            tags: item.tags || [],
            downloads: item.downloads || 0,
            likes: item.likes || 0,
            lastModified: new Date(item.lastModified || Date.now())
          }))
        };
        return results;
      } else {
        logger.error(`Failed to search datasets: ${response.statusText}`);
        return { datasets: [] };
      }
    } catch (err) {
      logger.error(`Error searching datasets: ${err}`);
      return { datasets: [] };
    }
  }

  public async datasetExists(repoId: string): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }
      const response = await axios({
        method: 'HEAD',
        url: `${this.config.apiUrl}/datasets/${repoId}`,
        headers,
        timeout: this.config.timeout
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  public async getDatasetInfo(repoId: string): Promise<any | null> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }
      const response = await axios({
        method: 'GET',
        url: `${this.config.apiUrl}/datasets/${repoId}`,
        headers,
        timeout: this.config.timeout
      });
      if (response.status === 200) {
        return response.data;
      } else {
        logger.error(`Failed to get dataset info: ${response.statusText}`);
        return null;
      }
    } catch (err) {
      logger.error(`Error getting dataset info: ${err}`);
      return null;
    }
  }

  public async listFiles(repoId: string, repoPath: string = '', revision = 'main'): Promise<any[] | null> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }
      const encodedPath = repoPath ? `/${encodeURIComponent(repoPath)}` : '';
      const response = await axios({
        method: 'GET',
        url: `${this.config.apiUrl}/datasets/${repoId}/tree/${revision}${encodedPath}`,
        headers,
        timeout: this.config.timeout
      });
      if (response.status === 200) {
        return response.data;
      } else {
        logger.error(`Failed to list files: ${response.statusText}`);
        return null;
      }
    } catch (err) {
      logger.error(`Error listing files: ${err}`);
      return null;
    }
  }

  /**
   * Extended / Merged methods from huggingFaceClientExtension
   */

  public async getDatasetConfig(datasetId: string): Promise<any | null> {
    try {
      const datasetInfo = await this.getDatasetInfo(datasetId);
      if (!datasetInfo) return null;
      const configFiles = ['config.json','dataset_infos.json','dataset_info.json','metadata.json'];
      let config = null;
      for (const configFile of configFiles) {
        try {
          const fileData = await this.downloadFile(datasetId, configFile);
          if (fileData) {
            config = JSON.parse(fileData.toString('utf-8'));
            break;
          }
        } catch {
          continue;
        }
      }
      return {
        ...datasetInfo,
        config: config || {}
      };
    } catch(err) {
      logger.error(`Error getting dataset config: ${err}`);
      return null;
    }
  }

  public async getDatasetStructure(datasetId: string): Promise<any | null> {
    try {
      const datasetInfo = await this.getDatasetInfo(datasetId);
      if (!datasetInfo) return null;
      const files = await this.listFiles(datasetId);
      if (!files || !Array.isArray(files)) return null;
      const filesByDirectory: Record<string,string[]> = {};
      const filesByType = {
        image: [] as string[],
        text: [] as string[],
        json: [] as string[],
        csv: [] as string[],
        other: [] as string[]
      };
      const categorizeFile = (filePath: string) => {
        if (/\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i.test(filePath)) filesByType.image.push(filePath);
        else if(/\.txt$/i.test(filePath)) filesByType.text.push(filePath);
        else if(/\.json$/i.test(filePath)) filesByType.json.push(filePath);
        else if(/\.csv$/i.test(filePath)) filesByType.csv.push(filePath);
        else filesByType.other.push(filePath);
      };
      for(const file of files) {
        if (typeof file !== 'object' || !file.path) continue;
        const filePath = file.path as string;
        const directory = filePath.includes('/')? filePath.substring(0,filePath.lastIndexOf('/')): '';
        if(!filesByDirectory[directory]) filesByDirectory[directory] = [];
        filesByDirectory[directory].push(filePath);
        categorizeFile(filePath);
      }
      const configFiles = ['config.json','dataset_infos.json','dataset_info.json','metadata.json'];
      let config = null;
      for(const cfile of configFiles) {
        if(filesByType.json.includes(cfile)) {
          try {
            const fdata = await this.downloadFile(datasetId, cfile);
            if (fdata) {
              config = JSON.parse(fdata.toString('utf-8'));
              break;
            }
          } catch {}
        }
      }
      const dataSplits:Record<string,any> = {};
      const splitDirectories = ['train','validation','test','val','dev'];
      for(const splitDir of splitDirectories) {
        if(filesByDirectory[splitDir]) {
          dataSplits[splitDir] = {
            count: filesByDirectory[splitDir].length,
            directory: splitDir,
            files: filesByDirectory[splitDir]
          };
        }
      }
      const categoryDirectories: string[] = [];
      for(const directory in filesByDirectory) {
        if(splitDirectories.includes(directory) || directory === '' 
           || ['config','metadata','utils','scripts'].includes(directory)) continue;
        const directoryFiles = filesByDirectory[directory];
        if(!directoryFiles || directoryFiles.length===0) continue;
        const imageCount = directoryFiles.filter(f=>/\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i.test(f)).length;
        if(imageCount>0 && imageCount/directoryFiles.length>0.5) {
          categoryDirectories.push(directory);
        }
      }
      return {
        id: datasetId,
        name: datasetInfo.name||datasetId.split('/').pop(),
        description: datasetInfo.description||'',
        directories: Object.keys(filesByDirectory),
        filesByDirectory,
        filesByType,
        config,
        dataSplits,
        categoryDirectories,
        totalFiles: files.length
      };
    } catch(err) {
      logger.error(`Error getting dataset structure: ${err}`);
      return null;
    }
  }

  public async getDatasetSamples(
    datasetId:string,
    filters: Record<string,any>={},
    limit=100
  ): Promise<any[]|null> {
    try{
      const datasetInfo = await this.getDatasetInfo(datasetId);
      if(!datasetInfo) return null;
      const structure = await this.getDatasetStructure(datasetId);
      if(!structure) return null;
      const category = filters.category||'';
      const allFiles:string[] = [];
      if(category && structure.filesByDirectory[category]) {
        allFiles.push(...structure.filesByDirectory[category]);
      } else {
        for(const dir in structure.filesByDirectory) {
          if(category && !dir.includes(category)) continue;
          allFiles.push(...structure.filesByDirectory[dir]);
        }
      }
      let samplesFiles = allFiles;
      if(filters.type === 'image' || !filters.type) {
        samplesFiles = allFiles.filter(f=>/\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i.test(f));
      } else if(filters.type==='text') {
        samplesFiles = allFiles.filter(f=>/\.(txt|json|md|csv)$/i.test(f));
      }
      samplesFiles = samplesFiles.slice(0,limit);
      const samples = samplesFiles.map((fpath,index)=>{
        const fileDir = fpath.includes('/')? fpath.substring(0,fpath.lastIndexOf('/')):'';
        const fileName = fpath.split('/').pop()||fpath;
        const fileCategory = fileDir!==''? fileDir.split('/')[0]:'';
        return {
          path:fpath,
          image_path: /\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i.test(fpath)? fpath:null,
          text_path: /\.(txt|json|md|csv)$/i.test(fpath)? fpath:null,
          category:fileCategory||category||'',
          index,
          metadata:{
            source:datasetId,
            directory:fileDir,
            filename:fileName
          }
        };
      });
      return samples;
    } catch(err) {
      logger.error(`Error getting dataset samples: ${err}`);
      return null;
    }
  }

  public async getDatasetSampleImage(datasetId:string, imagePath:string):Promise<Buffer|null>{
    try{
      try {
        const imageData = await this.downloadFile(datasetId, imagePath);
        if(imageData) return Buffer.from(imageData);
      } catch(e) {
        logger.warn(`Could not download directly, fallback: ${e}`);
      }
      const branches = ['main','master','datasets'];
      for(const branch of branches) {
        try{
          const publicUrl=`https://huggingface.co/datasets/${datasetId}/resolve/${branch}/${imagePath}`;
          const response=await axios.get(publicUrl, {
            responseType:'arraybuffer',timeout:10000,
            validateStatus: (s)=>s===200
          });
          if(response.status===200 && response.data) {
            return Buffer.from(response.data);
          }
        }catch{}
      }
      try {
        const repoName=datasetId.includes('/')? datasetId.split('/')[1]:datasetId;
        const owner=datasetId.includes('/')? datasetId.split('/')[0]:'';
        if(owner) {
          const githubUrl=`https://raw.githubusercontent.com/${owner}/${repoName}/main/${imagePath}`;
          const response=await axios.get(githubUrl, {
            responseType:'arraybuffer',timeout:10000,validateStatus:(s)=>s===200
          });
          if(response.status===200 && response.data) {
            return Buffer.from(response.data);
          }
        }
      } catch{}
      logger.warn(`Placeholder for ${imagePath} in dataset ${datasetId}.`);
      return Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64'
      );
    } catch(err){
      logger.error(`Error getting dataset sample image: ${err}`);
      return null;
    }
  }

  public async getDatasetSplit(datasetId:string, splitName:string):Promise<any|null>{
    try{
      const structure=await this.getDatasetStructure(datasetId);
      if(!structure)return null;
      if(structure.dataSplits&&structure.dataSplits[splitName]) {
        return structure.dataSplits[splitName];
      }
      const splitDir=structure.directories.find((dir:string)=>dir===splitName||dir.endsWith(`/${splitName}`));
      if(splitDir) {
        const filesInSplit=structure.filesByDirectory[splitDir]||[];
        const imageFiles=filesInSplit.filter((f:string)=>/\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i.test(f));
        const textFiles=filesInSplit.filter((f:string)=>/\.(txt|json|csv|md)$/i.test(f));
        const features:Record<string,any>={};
        if(imageFiles.length>0) {
          features.image={type:'image',count:imageFiles.length};
        }
        if(textFiles.length>0) {
          features.text={type:'text',count:textFiles.length};
        }
        let splitConfig=null;
        const configFiles=[`${splitName}_config.json`,`config_${splitName}.json`,`${splitName}.json`];
        for(const configFile of configFiles) {
          try {
            if(filesInSplit.includes(configFile)||structure.filesByDirectory[''].includes(configFile)) {
              const cdata=await this.downloadFile(datasetId,configFile);
              if(cdata) {
                splitConfig=JSON.parse(cdata.toString('utf-8'));break;
              }
            }
          } catch{}
        }
        return{
          name:splitName,
          directory:splitDir,
          num_rows:Math.max(imageFiles.length,textFiles.length),
          features,
          files:filesInSplit,
          config:splitConfig
        };
      }
      const splitFiles=(Object.values(structure.filesByDirectory).flat() as string[]).filter((f: string)=>f.includes(`/${splitName}/`)||f.includes(`_${splitName}.`));
      if(splitFiles.length>0) {
        return{
          name:splitName,
          directory:null,
          num_rows:splitFiles.length,
          features:{
            data:{type:'unknown',count:splitFiles.length}
          },
          files:splitFiles,
          config:null
        };
      }
      return null;
    } catch(err){
      logger.error(`Error getting dataset split ${splitName}: ${err}`);
      return null;
    }
  }

  public async getDatasetRow(datasetId:string, splitName:string, rowIndex:number):Promise<any|null>{
    try{
      const splitInfo=await this.getDatasetSplit(datasetId,splitName);
      if(!splitInfo||!splitInfo.files||rowIndex>=splitInfo.num_rows)return null;
      const files=splitInfo.files;
      if(rowIndex>=files.length)return null;
      const filePath=files[rowIndex];
      if(!filePath)return null;
      const isImage=/\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i.test(filePath);
      const isJson=/\.json$/i.test(filePath);
      const isCsv=/\.csv$/i.test(filePath);
      const isText=/\.txt$/i.test(filePath);
      const rowData:Record<string,any>={
        index:rowIndex,
        path:filePath,
        split:splitName,
        metadata:{
          path:filePath,
          directory:filePath.includes('/')? filePath.substring(0,filePath.lastIndexOf('/')):'',
          filename:filePath.split('/').pop()||filePath
        }
      };
      if(isImage) rowData.image=filePath;
      if(isJson) {
        try{
          const fileContent=await this.downloadFile(datasetId,filePath);
          if(fileContent) {
            const jData=JSON.parse(fileContent.toString('utf-8'));
            rowData.data=jData;
          }
        }catch(e){
          logger.warn(`Failed to parse JSON data from ${filePath}: ${e}`);
        }
      }
      if(isCsv) {
        try{
          const fileContent=await this.downloadFile(datasetId,filePath);
          if(fileContent) {
            const csvContent=fileContent.toString('utf-8');
            const lines=csvContent.split('\n').slice(0,10);
            if(lines.length>0) {
              const headers=lines[0].split(',').map((h:string)=>h.trim());
            if(lines.length>1) {
              const values=lines[1].split(',').map((v:string)=>v.trim());
              const rowObj:Record<string,string>={};
              headers.forEach((header: string, i: number)=>{ if(i<values.length) rowObj[header]=values[i];});
              rowData.data=rowObj;
              } else {
                rowData.data={headers};
              }
            }
          }
        }catch(e){
          logger.warn(`Failed to parse CSV data from ${filePath}: ${e}`);
        }
      }
      if(isText){
        try{
          const fileContent=await this.downloadFile(datasetId,filePath);
          if(fileContent) {
            rowData.text=fileContent.toString('utf-8');
          }
        } catch(e){
          logger.warn(`Failed to get text from ${filePath}: ${e}`);
        }
      }
      return rowData;
    } catch(err){
      logger.error(`Error getting dataset row ${rowIndex} from ${splitName}: ${err}`);
      return null;
    }
  }

  public async downloadRow(datasetId:string, splitName:string, rowIndex:number, field='image'):Promise<Buffer|null>{
    try{
      const rowData=await this.getDatasetRow(datasetId,splitName,rowIndex);
      if(!rowData) return null;
      if(field==='image'&&rowData.image){
        return this.getDatasetSampleImage(datasetId,rowData.image);
      }
      if(field in rowData){
        const fieldValue=rowData[field];
        if(typeof fieldValue==='string'&&(fieldValue.includes('/')||fieldValue.includes('.'))){
          const fData=await this.downloadFile(datasetId,fieldValue);
          if(fData) {
            return Buffer.from(fData);
          }
        }
        return Buffer.from(JSON.stringify(fieldValue,null,2));
      }
      return null;
    } catch(err){
      logger.error(`Error downloading field ${field} from row ${rowIndex} in ${splitName}: ${err}`);
      return null;
    }
  }
}

export const huggingFaceClient = new HuggingFaceClientCore();
export default huggingFaceClient;