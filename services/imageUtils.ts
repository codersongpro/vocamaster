// 업로드 이미지 자동 축소·재압축 유틸
// 서버리스 함수의 요청 본문 한도(약 4.5MB)를 넘지 않도록,
// 브라우저에서 미리 해상도와 품질을 낮춰 전송 용량을 줄입니다.

// 단어장 OCR에 필요한 글자 선명도를 유지하는 선에서 정한 값입니다.
export const MAX_IMAGE_DIMENSION = 2000;
export const JPEG_QUALITY = 0.85;

// 파일을 이미지 엘리먼트로 로드합니다. (브라우저가 EXIF 회전 정보를 자동 반영합니다)
const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지를 읽을 수 없습니다.'));
    };
    image.src = objectUrl;
  });
};

const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('이미지 변환에 실패했습니다.'))),
      'image/jpeg',
      JPEG_QUALITY
    );
  });
};

// 이미지 파일을 축소·재압축한 새 파일로 반환합니다.
// 이미지가 아니거나, 변환에 실패하거나, 결과가 원본보다 크면 원본을 그대로 반환합니다.
export const compressImageFile = async (file: File): Promise<File> => {
  if (!file.type.startsWith('image/')) return file;

  try {
    const image = await loadImage(file);
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    if (longestSide === 0) return file;

    const scale = Math.min(1, MAX_IMAGE_DIMENSION / longestSide);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);

    const context = canvas.getContext('2d');
    if (!context) return file;

    // 투명 배경(PNG)이 JPEG 변환 시 검게 나오지 않도록 흰색으로 채웁니다.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await canvasToBlob(canvas);
    if (blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
};
