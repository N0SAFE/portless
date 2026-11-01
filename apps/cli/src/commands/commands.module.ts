import { Module } from "@nestjs/common";
import { CommonModule } from "../common/common.module.js";
import { RunCommand } from "./run.command.js";
import { RunSubCommand } from "./run-sub.command.js";
import { AliasCommand } from "./alias.command.js";
import { ListCommand } from "./list.command.js";
import { DoctorCommand } from "./doctor.command.js";
import { TrustCommand } from "./trust.command.js";
import { CleanCommand } from "./clean.command.js";
import { PruneCommand } from "./prune.command.js";
import { HostsCommand } from "./hosts.command.js";
import { ProxyCommand } from "./proxy.command.js";
import { DaemonCommand } from "./daemon.command.js";
import { ServiceCommand } from "./service.command.js";
import { ConfigCommand } from "./config.command.js";
import { PluginsCommand } from "./plugins.command.js";
import { DevCommand } from "./dev.command.js";
import { InitCommand } from "./init.command.js";

/**
 * Registers every CLI command. The first/no-name command (`RunCommand`) is the
 * program root; all named commands become subcommands via nest-commander.
 */
@Module({
  imports: [CommonModule],
  providers: [
    RunCommand,
    RunSubCommand,
    AliasCommand,
    ListCommand,
    DoctorCommand,
    TrustCommand,
    CleanCommand,
    PruneCommand,
    HostsCommand,
    ProxyCommand,
    DaemonCommand,
    ServiceCommand,
    ConfigCommand,
    PluginsCommand,
    DevCommand,
    InitCommand,
  ],
})
export class CommandsModule {}
