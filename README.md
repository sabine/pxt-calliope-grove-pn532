# pxt-calliope-grove-pn532 - Seeedstudio Grove NFC

Read and write text from and to Mifare Classic chips with MakeCode, with your micro:bit or Calliope mini. This is https://github.com/infchem/pxt-calliope-grove-pn532 rewritten in the following ways:

* some refactoring so that code for checksum generation for the pn532's protocol only exists once
* authentication implemented
* I threw out the NDEF data format due to lack of time
* this library allows you to use Mifare Classic cards, but not Mifare Ultralight (as the original library). So, every read and write authenticates using the default key FF FF FF FF FF FF.

Keys can currently not be set to a different value, but feel free to clone this and adapt it to your needs.

## License

Licensed under the MIT License (MIT). See LICENSE file for more details.

## Supported targets

* for PXT/microbit
* for PXT/calliope
