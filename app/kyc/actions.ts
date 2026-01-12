"use server";

export async function verifyFaceAI(formData: FormData) {
  try {
    // 1. Rekipere foto yo ki sot nan fòm nan
    const idCard = formData.get('idCard');
    const selfie = formData.get('selfie');

    // 2. Kreye yon nouvo FormData espesyal pou Face++
    const facePlusData = new FormData();
    facePlusData.append('api_key', 'OdyY1DrNRIqTlWG7r3ByTzZzN7r31S_y'); // Kle htexcard ou a
    facePlusData.append('api_secret', 'Vkn3jhh0y0N65FljmNw_P4-RXx44UEsA'); // Piga ou bliye sekrè a
    facePlusData.append('image_file1', idCard as File);
    facePlusData.append('image_file2', selfie as File);

    // 3. Voye apèl la bay Face++ US Server
    const res = await fetch('https://api-us.faceplusplus.com/facepp/v3/compare', {
      method: 'POST',
      body: facePlusData // Se facePlusData nou voye kounye a
    });

    const result = await res.json();

    // Si Face++ voye yon erè (tankou kle pa bon)
    if (result.error_message) {
      console.error("Erè Face++:", result.error_message);
      throw new Error("Pwoblèm konfigirasyon kle API.");
    }

    // 4. Tcheke si figi yo koresponn (Confidence > 75)
    if (result.confidence && result.confidence > 75) {
      return { success: true, name: "VERIFIED" };
    }
    
    return { error: "Figi ou pa koresponn ak foto ID a. Tanpri pran yon pi bèl foto." };

  } catch (err: any) {
    return { error: err.message || "Erè nan sistèm verifikasyon an." };
  }
}