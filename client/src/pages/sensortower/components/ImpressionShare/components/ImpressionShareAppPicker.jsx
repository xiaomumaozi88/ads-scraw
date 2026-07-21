import GalleryAppPicker from '../../CreativeGallery/GalleryAppPicker.jsx';
import { IS_PLATFORMS } from '../../../constants/impressionShareConstants.js';

export default function ImpressionShareAppPicker(props) {
  return <GalleryAppPicker {...props} platforms={IS_PLATFORMS} />;
}
