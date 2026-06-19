import type { Track } from "./track";

export class Queue {
  private tracks: Track[] = [];

  enqueue(track: Track): void {
    this.tracks.push(track);
  }

  dequeue(): Track | undefined {
    return this.tracks.shift();
  }

  peek(): Track | undefined {
    return this.tracks[0];
  }

  get list(): readonly Track[] {
    return this.tracks;
  }

  get isEmpty(): boolean {
    return this.tracks.length === 0;
  }

  get size(): number {
    return this.tracks.length;
  }

  // In-place Fisher-Yates shuffle of the pending tracks (the playing track lives
  // on the GuildPlayer, not here, so it's unaffected).
  shuffle(): void {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
  }

  clear(): void {
    this.tracks = [];
  }
}
