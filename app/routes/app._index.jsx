import { useEffect, useState, useRef } from "react";
import { json } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  DropZone,
  Thumbnail,
  Box,
  List,
  Link,
  InlineStack,
  Modal,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import {
  ArrowRightIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@shopify/polaris-icons';
import { authenticate } from "../shopify.server";
// import { bodyoutline } from "../../public/imgpsh_fullsize_anim.png";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return null;
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        input: {
          title: `${color} Snowboard`,
        },
      },
    },
  );
  const responseJson = await response.json();
  const product = responseJson.data.productCreate.product;
  const variantId = product.variants.edges[0].node.id;
  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );
  const variantResponseJson = await variantResponse.json();

  return json({
    product: responseJson.data.productCreate.product,
    variant: variantResponseJson.data.productVariantsBulkUpdate.productVariants,
  });
};

// Custom modal component
const CustomModal = ({ isVisible, onClose, children }) => {
  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: "scroll",
        paddingTop: "30%",
        zIndex: 1000,
      }}
      onClick={onClose} // Close modal when clicking outside the content
    >
      <div
        onClick={(e) => e.stopPropagation()} // Prevent click events from bubbling up
        style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '20px',
          width: '450px',
          maxWidth: '90vw',
          position: 'relative',
          boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'transparent',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
          }}
        >
          ✖️
        </button>

        {children}
      </div>
    </div>
  );
};

export default function Index() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";
  const productId = fetcher.data?.product?.id.replace(
    "gid://shopify/Product/",
    "",
  );

  useEffect(() => {
    if (productId) {
      shopify.toast.show("Product created");
    }
  }, [productId, shopify]);

  const [modalView, setModalView] = useState(false);
  const [file, setFile] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [scale, setScale] = useState(1);

  const toggleModal = () => setModalView(!modalView);

  const handlePositionChange = (direction) => {
    setPosition((prev) => ({
      ...prev,
      top: direction === 'up' ? prev.top - 20 : direction === 'down' ? prev.top + 20 : prev.top,
      left: direction === 'left' ? prev.left - 20 : direction === 'right' ? prev.left + 20 : prev.left,
    }));
  };

  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  console.log('image', imageSrc);
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result); // Assuming you have a state to set imageSrc
      };
      reader.readAsDataURL(file);
    }
  };
  // // Function to handle file upload
  const handselectleDrop = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageSrc(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };
  const openModal = () => setModalView(true);
  const closeModal = () => setModalView(false);
  // Function to open file input dialog
  const handleCustomButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleScaleChange = (change) => {
    setScale((prev) => {
      const newScale = prev + change;
      return Math.min(Math.max(newScale, -20), 20); // Limits scale between 0.5 and 3
    });
  };
  
  // State to store image dimensions and offset
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [initialPosition, setInitialPosition] = useState({ top: 0, left: 0 });

  // Function to handle image load and calculate initial center position
  const handleImageLoad = (event) => {
    const { naturalWidth, naturalHeight } = event.target;
    setImageDimensions({ width: naturalWidth, height: naturalHeight });

    // Calculate the initial offset to center the image in the 400x400 container
    const topOffset = (naturalHeight - 400) / 2;
    const leftOffset = (naturalWidth - 400) / 2;

    setInitialPosition({ top: -topOffset, left: -leftOffset });
  };

  return (
    <Page>
      <TitleBar title="画像アップロード及びサイズ調整">
        <button variant="primary" onClick={toggleModal} >
          画像を選択
        </button>
      </TitleBar>
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <InlineStack gap="300">
                  <Button 
                    loading={isLoading} 
                    onClick={toggleModal}
                    variant="secondary"
                    style={{ backgroundColor: '#0e5c14', color: 'balck' }}
                  >
                    画像を選択
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
        {modalView && (
          <CustomModal isVisible={modalView} onClose={closeModal}>
          {/* Modal content (from your provided code) */}
          <div onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDrop={handleDrop}
            style={{ position: 'relative', width: '400px', height: "730px", overflow: 'hidden' }}>
            {/* Centered instructional text */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: '10px' }}>
              <h1 style={{ fontSize: "18px", fontWeight: "600" }}>画像をアップロード</h1>
            </div>
            <div style={{ display: "flex", paddingTop: "10px", justifyContent: "center", marginBottom: '10px' }}>
              <p style={{ fontSize: "16px" }}>人の枠程度の大きさに合わせてください</p>
            </div>
  
            {/* Uploaded image container (only shown if `imageSrc` is available) */}
            {imageSrc && (
              <div
                style={{
                  width: '400px',
                  height: '400px',
                  position: 'absolute',
                  top: '40%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  overflow: 'hidden',
                  borderRadius: "20px",
                  zIndex: 1,
                }}
              >
                <img
                  src={imageSrc}
                  alt="Adjustable"
                  onLoad={handleImageLoad}
                  style={{
                    position: 'absolute',
                    top: `${initialPosition.top + position.top}px`,
                    left: `${initialPosition.left + position.left}px`,
                    transform: `scale(${scale})`,
                    transition: 'top 0.2s, left 0.2s, transform 0.2s',
                  }}
                />
              </div>
            )}

            {/* Body outline image (foreground) */}
            <img
              src="/imgpsh_fullsize_anim.png"
              alt="Body Outline"
              style={{
                width: '400px',
                height: '400px',
                position: 'absolute',
                top: '40%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 999,
                backgroundColor: "gray",
                opacity: "70%",
                borderRadius: "20px"
              }}
            />

            {/* Hidden file input */}
            <input
              type="file"
              accept="image/*"
              onChange={handselectleDrop}
              ref={fileInputRef}
              style={{ display: 'none' }}
            />

            {/* Custom Upload Button */}
            <div style={{ position: 'absolute', bottom: '200px', left: '50%', transform: 'translateX(-50%)', width: '400px' }}>
              <Button onClick={handleCustomButtonClick} fullWidth>
                {imageSrc ? '画像を変更' : '画像の選択' }
              </Button>
            </div>
  
            {/* Arrow and Scale Controls */}
            <div style={{ position: 'absolute', bottom: '80px', left: '50%', transform: 'translateX(-50%)', backgroundColor: "gray", width: "100%", borderRadius: "10px", padding: "10px", display: "flex", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <Button icon={ArrowUpIcon} onClick={() => handlePositionChange('up')} />
                <div style={{ display: "flex", justifyContent: "center", gap: "30px" }}>
                  <Button icon={ArrowLeftIcon} onClick={() => handlePositionChange('left')} />
                  <Button icon={ArrowRightIcon} onClick={() => handlePositionChange('right')} />
                </div>
                <Button icon={ArrowDownIcon} onClick={() => handlePositionChange('down')} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", paddingTop: "10px" }}>
                <Button onClick={() => handleScaleChange(0.1)}>拡大</Button>
                <Button onClick={() => handleScaleChange(-0.1)}>縮小</Button>
              </div>
            </div>
            <div style={{ position: "absolute", bottom: "35px", left: "50%", transform: "translateX(-50%)", width: "100%"}}>
              <Button onClick={closeModal} fullWidth>アップロード</Button>
            </div>
            <div style={{ position: "absolute", bottom: "2px", left: "50%", transform: "translateX(-50%)", width: "100%"}}>
              <Button onClick={closeModal} fullWidth>キャンセル</Button>
            </div>
          </div>
        </CustomModal>
        )}
      </BlockStack>
    </Page>
  );
}
