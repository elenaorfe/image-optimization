// Select all images on the page
const images = document.querySelectorAll('img');

images.forEach(img => {
  // Get image dimensions
  const imgRect = img.getBoundingClientRect();
  const imgArea = imgRect.width * imgRect.height;

  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const viewportArea = viewportWidth * viewportHeight;

  // Calculate percentage
  const percentage = ((imgArea / viewportArea) * 100).toFixed(2);

  // Display the result
  console.log(`Image occupies ${percentage}% of the viewport.`);
});