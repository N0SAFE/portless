import { Module } from "@nestjs/common";
import { CommandsModule } from "./commands/commands.module.js";
import { CommonModule } from "./common/common.module.js";

/**
 * PortlessCliModule — root module for the CLI. The CommandsModule registers
 * every `@Command` class (the no-name one becomes the program root).
 */
@Module({
  imports: [CommonModule, CommandsModule],
})
export class AppModule {}
