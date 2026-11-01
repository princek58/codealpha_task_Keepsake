const fs = require('fs');
const path = require('path');

const deleteUploadFile = (fileUrlOrName) => {
  if (!fileUrlOrName || typeof fileUrlOrName !== 'string') return;

  const filename = path.basename(fileUrlOrName);
  const filePath = path.join(__dirname, '../uploads', filename);

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Safely ignore if unlink fails
    }
  }
};

module.exports = {
  deleteUploadFile
};

