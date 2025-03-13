export const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";

        const timeout = setTimeout(() => {
            reject(new Error("Image load timeout"));
        }, 5000);

        img.onload = () => {
            clearTimeout(timeout);
            resolve(img);
        };

        img.onerror = () => {
            clearTimeout(timeout);
            reject(new Error("Image load error"));
        };

        img.src = url;
    });
};

export const analyzeColorfulness = (
    img: HTMLImageElement,
    canvas: HTMLCanvasElement
): number => {
    try {
        if (!img.complete || img.naturalWidth === 0) {
            return 0;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) return 0;

        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        ctx.drawImage(img, 0, 0);

        const sampleSize = 20;
        const uniqueColors = new Set<string>();

        for (let y = 0; y < sampleSize; y++) {
            for (let x = 0; x < sampleSize; x++) {
                const sampleX = Math.floor((x / sampleSize) * canvas.width);
                const sampleY = Math.floor((y / sampleSize) * canvas.height);

                try {
                    const data = ctx.getImageData(sampleX, sampleY, 1, 1).data;
                    const r = data[0];
                    const g = data[1];
                    const b = data[2];

                    const colorKey = `${r},${g},${b}`;
                    uniqueColors.add(colorKey);
                } catch (error) {
                    // Ignore errors for individual pixels
                }
            }
        }

        return uniqueColors.size;
    } catch (error) {
        // If any error occurs, return 0
        return 0;
    }
};

/**
 * Compares two possible avatar URLs for an X username (with and without @ prefix)
 * and returns the URL that produces the more colorful/detailed image
 */
export const getBestAvatarUrl = async (username: string): Promise<string> => {
    const cleanUsername = username.trim().replace(/^@/, "");
    const withAtUrl = `https://unavatar.io/x/@${cleanUsername}`;
    const withoutAtUrl = `https://unavatar.io/x/${cleanUsername}`;

    let finalUrl = withoutAtUrl; // Default fallback

    try {
        const withAtCanvas = document.createElement("canvas");
        const withoutAtCanvas = document.createElement("canvas");

        const [withAtImg, withoutAtImg] = await Promise.allSettled([
            loadImage(withAtUrl),
            loadImage(withoutAtUrl)
        ]);

        // Compare colorfulness if both images loaded successfully
        if (withAtImg.status === "fulfilled" && withoutAtImg.status === "fulfilled") {
            const withAtColorfulness = analyzeColorfulness(withAtImg.value, withAtCanvas);
            const withoutAtColorfulness = analyzeColorfulness(withoutAtImg.value, withoutAtCanvas);

            // Choose the image with more unique colors
            if (withAtColorfulness > withoutAtColorfulness) {
                finalUrl = withAtUrl;
            } else {
                finalUrl = withoutAtUrl;
            }
        }
        // If only one loaded successfully, use that one
        else if (withAtImg.status === "fulfilled") {
            finalUrl = withAtUrl;
        } else if (withoutAtImg.status === "fulfilled") {
            finalUrl = withoutAtUrl;
        }
    } catch (error) {
        console.error("Error comparing avatar images:", error);
    }

    return finalUrl;
};
