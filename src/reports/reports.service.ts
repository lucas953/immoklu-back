import { Injectable } from "@nestjs/common";

@Injectable()
export class ReportsService {
  create() {
    return { resource: "reports", action: "create" };
  }

  findAll() {
    return [];
  }

  findOne(reportId: string) {
    return { reportId };
  }

  download(reportId: string) {
    return { reportId, action: "download" };
  }
}
