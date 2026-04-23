import { Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { DocumentsService } from "./documents.service";

@Controller({ path: "documents", version: "1" })
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post("uploads/initiate")
  initiateUpload() {
    return this.documentsService.initiateUpload();
  }

  @Post()
  create() {
    return this.documentsService.create();
  }

  @Get()
  findAll() {
    return this.documentsService.findAll();
  }

  @Get(":documentId")
  findOne(@Param("documentId") documentId: string) {
    return this.documentsService.findOne(documentId);
  }

  @Patch(":documentId")
  update(@Param("documentId") documentId: string) {
    return this.documentsService.update(documentId);
  }

  @Delete(":documentId")
  remove(@Param("documentId") documentId: string) {
    return this.documentsService.remove(documentId);
  }

  @Get(":documentId/download-url")
  getDownloadUrl(@Param("documentId") documentId: string) {
    return this.documentsService.getDownloadUrl(documentId);
  }
}
