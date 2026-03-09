export class Image {
  private readonly image: HTMLImageElement

  private constructor(image: HTMLImageElement) {
    this.image = image
  }

  static fromSrc(src: string): Image {
    const image = new window.Image()
    image.src = src
    return new Image(image)
  }

  static async load(src: string): Promise<Image> {
    return await new Promise<Image>((resolve, reject) => {
      const image = new window.Image()
      image.onload = () => resolve(new Image(image))
      image.onerror = () => reject(new Error(`Failed to load ${src}`))
      image.src = src
    })
  }

  getWidth(): number {
    return this.image.naturalWidth || this.image.width
  }

  getHeight(): number {
    return this.image.naturalHeight || this.image.height
  }

  getElement(): HTMLImageElement {
    return this.image
  }
}
