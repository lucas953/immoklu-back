import { Injectable } from "@nestjs/common";

@Injectable()
export class DocumentsService {
  initiateUpload() {
    return { action: "initiate-upload" };
  }

  create() {
    return { resource: "documents", action: "create" };
  }

  findAll() {
    return [];
  }

  findOne(documentId: string) {
    return { documentId };
  }

  update(documentId: string) {
    return { documentId, action: "update" };
  }

  remove(documentId: string) {
    return { documentId, action: "remove" };
  }

  getDownloadUrl(documentId: string) {
    return { documentId, action: "download-url" };
  }
}
