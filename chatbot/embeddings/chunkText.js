function chunkText(
   text,
   chunkSize = 1000,
   overlap = 200
) {

    const chunks = [];

    for (
      let i = 0;
      i < text.length;
      i += chunkSize - overlap
    ) {

        chunks.push(
           text.slice(
              i,
              i + chunkSize
           )
        );
    }

    return chunks;
}

export default chunkText;