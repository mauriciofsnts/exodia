import type { Track } from "./track.js";

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

  clear(): void {
    this.tracks = [];
  }
}
