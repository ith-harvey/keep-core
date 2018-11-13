package ephemeral

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"

	"github.com/btcsuite/btcd/btcec"
)

type SymmetricEcdhKey struct {
	key [sha256.Size]byte
}

func (pk *PrivateEcdsaKey) Ecdh(publicKey *PublicEcdsaKey) *SymmetricEcdhKey {
	shared := btcec.GenerateSharedSecret(pk.toBtcec(), publicKey.toBtcec())

	return &SymmetricEcdhKey{sha256.Sum256(shared)}
}

func (sek *SymmetricEcdhKey) Encrypt(plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(sek.key[:])
	if err != nil {
		return nil, fmt.Errorf("symmetric key encryption failed [%v]", err)
	}

	padded := addPKCSPadding(plaintext)

	// The IV needs to be unique, but not secure. Therefore it's common to
	// include it at the beginning of the ciphertext.
	ciphertext := make([]byte, aes.BlockSize+len(padded))
	iv := ciphertext[:aes.BlockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, fmt.Errorf("symmetric key encryption failed [%v]", err)
	}

	mode := cipher.NewCBCEncrypter(block, iv)
	mode.CryptBlocks(ciphertext[aes.BlockSize:], padded)

	return ciphertext, nil
}

func (sek *SymmetricEcdhKey) Decrypt(ciphertext []byte) ([]byte, error) {
	block, err := aes.NewCipher(sek.key[:])
	if err != nil {
		return nil, fmt.Errorf("symmetric key decryption failed [%v]", err)
	}

	if len(ciphertext) < aes.BlockSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	iv := ciphertext[:aes.BlockSize]
	ciphertext = ciphertext[aes.BlockSize:]

	// CBC mode always works in whole blocks.
	if len(ciphertext)%aes.BlockSize != 0 {
		return nil, fmt.Errorf("ciphertext is not a multiple of the block size")
	}

	mode := cipher.NewCBCDecrypter(block, iv)

	// CryptBlocks can work in-place if the two arguments are the same.
	mode.CryptBlocks(ciphertext, ciphertext)

	return removePKCSPadding(ciphertext)

}

// Implement PKCS#7 padding with block size of 16 (AES block size).

// addPKCSPadding adds padding to a block of data
func addPKCSPadding(src []byte) []byte {
	padding := aes.BlockSize - len(src)%aes.BlockSize
	padtext := bytes.Repeat([]byte{byte(padding)}, padding)
	return append(src, padtext...)
}

// removePKCSPadding removes padding from data that was added with addPKCSPadding
func removePKCSPadding(src []byte) ([]byte, error) {
	length := len(src)
	padLength := int(src[length-1])
	if padLength > aes.BlockSize || length < aes.BlockSize {
		return nil, errors.New("invalid PKCS#7 padding")
	}

	return src[:length-padLength], nil
}
