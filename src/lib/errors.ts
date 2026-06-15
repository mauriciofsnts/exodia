export class CommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommandError";
  }
}

export class PlayerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlayerError";
  }
}
