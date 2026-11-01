import { Module } from "@nestjs/common";
import { DaemonService } from "./daemon.service.js";

@Module({
  providers: [DaemonService],
  exports: [DaemonService],
})
export class CommonModule {}
