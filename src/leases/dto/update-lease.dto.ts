import { PartialType } from "@nestjs/swagger";
import { CreateLeaseDto } from "./create-lease.dto";

export class UpdateLeaseDto extends PartialType(CreateLeaseDto) {}
