export { SayCommand } from './SayCommand.js';
export { TpaCommand } from './TpaCommand.js';
export { MountMinecartCommand } from './MountMinecartCommand.js';
export { DismountCommand } from './DismountCommand.js';
export { UseCommandCommand } from './UseCommandCommand.js';
export { HelpCommand } from './HelpCommand.js';
interface CommandInfoDTO {
    [key: string]: CommandDescriptionDTO;
}
interface CommandDescriptionDTO {
    [key: string]: string;
}
export declare class CommandInfo {
    static descriptions: CommandInfoDTO;
}
//# sourceMappingURL=index.d.ts.map