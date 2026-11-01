import { Controller, Get, Post } from "@nestjs/common";
import { CertsService, type CertsStatus } from "../certs/certs.service.js";

@Controller("api/v1/certs")
export class CertsController {
  constructor(private readonly certs: CertsService) {}

  @Get()
  status(): CertsStatus {
    return this.certs.status();
  }

  @Post("trust")
  async trust(): Promise<CertsStatus> {
    return this.certs.trust();
  }
}
