import { Injectable } from '@angular/core';
import { auth } from '../firebase.config';

export type ImageUploadFolder = 'menu_items' | 'promotions';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

interface CloudinarySignResponse {
  success: boolean;
  message?: string;
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

@Injectable({
  providedIn: 'root',
})
export class ImageUploadService {
  async uploadImage(file: File, folder: ImageUploadFolder): Promise<string> {
    console.log('[IMG-UPLOAD] 1/6 start', { name: file.name, type: file.type, size: file.size, folder });

    if (!file.type.startsWith('image/')) {
      console.error('[IMG-UPLOAD] rejected: not an image type', file.type);
      throw new Error('El archivo seleccionado no es una imagen válida.');
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      console.error('[IMG-UPLOAD] rejected: file too large', file.size);
      throw new Error('La imagen no debe superar los 5 MB.');
    }

    console.log('[IMG-UPLOAD] 2/6 waiting for auth.authStateReady()...');
    await auth.authStateReady();
    console.log('[IMG-UPLOAD] 2/6 authStateReady resolved. auth.currentUser =', auth.currentUser?.uid ?? null);

    const idToken = await auth.currentUser?.getIdToken();
    console.log('[IMG-UPLOAD] 3/6 idToken obtained?', !!idToken, idToken ? `(len ${idToken.length})` : '');
    if (!idToken) {
      console.error('[IMG-UPLOAD] no idToken, aborting');
      throw new Error('No hay una sesion de administrador activa');
    }

    console.log('[IMG-UPLOAD] 4/6 calling /.netlify/functions/cloudinary-sign ...');
    let signResponse: Response;
    try {
      signResponse = await fetch('/.netlify/functions/cloudinary-sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ folder }),
      });
    } catch (networkError) {
      console.error('[IMG-UPLOAD] fetch to cloudinary-sign threw (network/CORS error):', networkError);
      throw networkError;
    }
    console.log('[IMG-UPLOAD] 4/6 cloudinary-sign responded. status =', signResponse.status, signResponse.ok);

    const signBody = await signResponse.text();
    console.log('[IMG-UPLOAD] 4/6 cloudinary-sign body =', signBody);

    let signData: CloudinarySignResponse;
    try {
      signData = JSON.parse(signBody);
    } catch {
      console.error('[IMG-UPLOAD] cloudinary-sign devolvio JSON invalido. status=', signResponse.status, 'body=', signBody);
      // Netlify devuelve los errores de inicializacion como texto plano "Error: ...".
      const readable = signBody.startsWith('Error:')
        ? signBody.slice('Error: '.length)
        : 'No se pudo autorizar la subida de la imagen.';
      throw new Error(readable);
    }

    if (!signResponse.ok || !signData.success) {
      console.error('[IMG-UPLOAD] cloudinary-sign failed', signResponse.status, signData);
      throw new Error(signData.message || 'No se pudo autorizar la subida de la imagen.');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', signData.apiKey);
    formData.append('timestamp', String(signData.timestamp));
    formData.append('signature', signData.signature);
    formData.append('folder', signData.folder);

    console.log('[IMG-UPLOAD] 5/6 uploading to Cloudinary, cloudName =', signData.cloudName);
    let uploadResponse: Response;
    try {
      uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`,
        { method: 'POST', body: formData },
      );
    } catch (networkError) {
      console.error('[IMG-UPLOAD] fetch to Cloudinary threw (network/CORS error):', networkError);
      throw networkError;
    }
    console.log('[IMG-UPLOAD] 5/6 Cloudinary responded. status =', uploadResponse.status, uploadResponse.ok);

    const uploadBody = await uploadResponse.text();
    console.log('[IMG-UPLOAD] 5/6 Cloudinary body =', uploadBody);

    let uploadData: any;
    try {
      uploadData = JSON.parse(uploadBody);
    } catch {
      console.error('[IMG-UPLOAD] Cloudinary devolvio JSON invalido', uploadResponse.status, uploadBody);
      throw new Error(uploadBody || 'Error al subir la imagen a Cloudinary.');
    }

    if (!uploadResponse.ok || !uploadData.secure_url) {
      console.error('[IMG-UPLOAD] Cloudinary upload failed', uploadResponse.status, uploadData);
      throw new Error(uploadData?.error?.message || 'Error al subir la imagen a Cloudinary.');
    }

    console.log('[IMG-UPLOAD] 6/6 done. secure_url =', uploadData.secure_url);
    return uploadData.secure_url as string;
  }
}
