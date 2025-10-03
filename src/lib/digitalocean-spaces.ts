/**
 * DigitalOcean Spaces API Client
 * Wrapper per gestire il storage su DigitalOcean Spaces (compatibile S3)
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'

interface DOSpacesConfig {
  endpoint: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

export class DOSpacesAPI {
  private client: S3Client
  private bucket: string

  constructor(config: DOSpacesConfig) {
    this.bucket = config.bucket
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: false, // Necessario per DigitalOcean Spaces
    })
  }

  /**
   * Upload a file to DigitalOcean Spaces
   */
  async uploadFile(
    key: string, 
    body: Buffer | Uint8Array | string, 
    contentType?: string
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ACL: 'public-read', // Rende il file pubblicamente accessibile
      })

      await this.client.send(command)
      
      // Ritorna l'URL pubblico del file
      const publicUrl = `https://${this.bucket}.nyc3.digitaloceanspaces.com/${key}`
      return publicUrl
    } catch (error) {
      console.error('Error uploading file to DO Spaces:', error)
      throw error
    }
  }

  /**
   * Delete a file from DigitalOcean Spaces
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })

      await this.client.send(command)
    } catch (error) {
      console.error('Error deleting file from DO Spaces:', error)
      throw error
    }
  }

  /**
   * List files in DigitalOcean Spaces
   */
  async listFiles(prefix?: string, maxKeys?: number): Promise<Array<Record<string, unknown>>> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys || 1000,
      })

      const response = await this.client.send(command)
      return (response.Contents || []) as Array<Record<string, unknown>>
    } catch {
      console.error('Error listing files from DO Spaces')
      throw new Error('Failed to list files from DigitalOcean Spaces')
    }
  }

  /**
   * Get file URL
   */
  getFileUrl(key: string): string {
    return `https://${this.bucket}.nyc3.digitaloceanspaces.com/${key}`
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })

      await this.client.send(command)
      return true
    } catch {
      return false
    }
  }

  /**
   * Delete multiple files
   */
  async deleteFiles(keys: string[]): Promise<void> {
    const deletePromises = keys.map(key => this.deleteFile(key))
    await Promise.all(deletePromises)
  }

  /**
   * Helper method: Upload video file with proper naming
   */
  async uploadVideo(
    file: Buffer | Uint8Array,
    originalName: string,
    postId?: string
  ): Promise<string> {
    const timestamp = Date.now()
    const extension = originalName.split('.').pop()
    const fileName = postId 
      ? `videos/${postId}/${timestamp}.${extension}`
      : `videos/${timestamp}_${originalName}`
    
    return this.uploadFile(fileName, file, 'video/mp4')
  }

  /**
   * Helper method: Upload image file with proper naming
   */
  async uploadImage(
    file: Buffer | Uint8Array,
    originalName: string,
    postId?: string
  ): Promise<string> {
    const timestamp = Date.now()
    const extension = originalName.split('.').pop()
    const fileName = postId 
      ? `images/${postId}/${timestamp}.${extension}`
      : `images/${timestamp}_${originalName}`
    
    const contentType = extension === 'png' ? 'image/png' : 'image/jpeg'
    return this.uploadFile(fileName, file, contentType)
  }
}
