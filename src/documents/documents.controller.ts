import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { InitiateDocumentUploadDto } from "./dto/initiate-document-upload.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { DocumentExtractionService } from "./extraction/document-extraction.service";
import { DocumentParsingService } from "./parsing/document-parsing.service";
import { DocumentsService } from "./documents.service";

@UseGuards(JwtAuthGuard)
@Controller("documents")
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly documentExtractionService: DocumentExtractionService,
    private readonly documentParsingService: DocumentParsingService
  ) {}

  @Post("uploads/initiate")
  initiateUpload(@CurrentUser() user: AuthenticatedUser, @Body() dto: InitiateDocumentUploadDto) {
    return this.documentsService.initiateUpload(user, dto);
  }

  @Post("uploads/direct")
  @UseInterceptors(FileInterceptor("file"))
  uploadDirect(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer }
  ) {
    return this.documentsService.uploadDirect(user, file);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDocumentDto) {
    return this.documentsService.create(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.findAll(user);
  }

  @Get(":documentId")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("documentId") documentId: string) {
    return this.documentsService.findOne(user, documentId);
  }

  @Patch(":documentId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("documentId") documentId: string,
    @Body() dto: UpdateDocumentDto
  ) {
    return this.documentsService.update(user, documentId, dto);
  }

  @Delete(":documentId")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("documentId") documentId: string) {
    return this.documentsService.remove(user, documentId);
  }

  @Get(":documentId/download-url")
  getDownloadUrl(@CurrentUser() user: AuthenticatedUser, @Param("documentId") documentId: string) {
    return this.documentsService.getDownloadUrl(user, documentId);
  }

  @Post(":documentId/extract-text")
  extractText(@CurrentUser() user: AuthenticatedUser, @Param("documentId") documentId: string) {
    return this.documentExtractionService.extractText(user, documentId);
  }

  @Get(":documentId/extraction")
  findExtraction(@CurrentUser() user: AuthenticatedUser, @Param("documentId") documentId: string) {
    return this.documentExtractionService.findExtraction(user, documentId);
  }

  @Post(":documentId/parse")
  parse(@CurrentUser() user: AuthenticatedUser, @Param("documentId") documentId: string) {
    return this.documentParsingService.parse(user, documentId);
  }
}
