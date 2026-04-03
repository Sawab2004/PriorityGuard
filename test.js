fetch("https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyAloxGcHrw1Rilpb7KQyBNNwAQi_wgmi7E")
  .then(r => r.json())
  .then(d => {
     if(d.models) const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
     else console.log(JSON.stringify(d));
  })
  .catch(console.error);
