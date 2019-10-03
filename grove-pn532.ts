/**
 * Functions for the Seeedstudio Grove NFC.
 * WIP: Reads NDEF text records from ISO14443-3A / Mifare
 *
 * @author Mirek Hancl, Alexander Pfanne, Sabine Schmaltz
 */

//% weight=2 color=#1174EE icon="\uf086" block="Grove NFC Tag"
//% parts="grove_pn532"
namespace grove_pn532 {
    /** Set this to true if you want serial output. */
    const DEBUG_SERIAL = true;

    const ADDRESS = 0x24;

    let targetID = 0;
    // if ISO14443-A / Mifare target found, targetID will be 1
    let targetNFCID = [0, 0, 0, 0];
    let targetKey = [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF];
    let running = false;
    // if PN532 isn't running, no reading will be possible
    
    // in these blocks, we store text data:
    let dataBlocks = [5,6, 8,9,10, 12,13,14, 16,17,18, 20,21,22];

    /**
     * ACK frame as specified in the PN532 User Manual (Page 30).
     * Used for synchronization or
     * to check if a previous frame has been recieved successfully.
     */
    const ACK_FRAME: number[] = [0x01, 0x00, 0x00, 0xFF, 0x00, 0xFF, 0x00];

    function debug_message(text: string): void {
        // music.playTone(262, music.beat(BeatFraction.Whole));
        serial.writeLine(text);
    }

    /**
     * Compares an array against output of the same length.
     * @param arr The array to compare the device output against.
     * @returns true if the output matches the passed array, false otherwise.
     */
    function checkOutput(arr: number[]): boolean {
        let outputFrame = pins.i2cReadBuffer(ADDRESS, arr.length);
        for (let i = 0; i <= arr.length - 1; i++) {
            if (outputFrame.getNumber(NumberFormat.UInt8LE, i) != arr[i]) {

                //Printing the array that was received.
                if (DEBUG_SERIAL) {
                    let string = "Failed to compare with: ";
                    for (let i = 0; i < outputFrame.length; i++) {
                        string += decToHex(outputFrame.getNumber(NumberFormat.UInt8LE, i)) + " ";
                    }
                    debug_message(string);
                    basic.pause(50);
                }

                return false;
            }
        }
        basic.pause(50);

        return true;
    }

    /**
     * Writes an array as buffer to the target device.
     * The array should be a normal information frame
     * with the format specified in the PN532 User Manual (Page 28).
     * @param arr The array to write to the device as a buffer.
     */
    function writeBuffer(arr: number[]): void {
        let inputFrame = pins.createBuffer(arr.length);
        for (let i = 0; i <= inputFrame.length - 1; i++) {
            inputFrame.setNumber(NumberFormat.UInt8LE, i, arr[i]);
        }
        pins.i2cWriteBuffer(ADDRESS, inputFrame);
        basic.pause(50);
    }

    function readFrame(): Buffer {

        let buffer = pins.i2cReadBuffer(ADDRESS, 64);
        let len = buffer[4];
        let outputFrame = buffer.slice(0, len + 8);

        if (outputFrame[0] != 0x01) {
            if (DEBUG_SERIAL)
                debug_message("outputFrame[0] != 0x01");

        }

        if (DEBUG_SERIAL) {
            debug_message("read frame:");
            printBufferAsHex(outputFrame);
        }

        return outputFrame;
    }

    /**
     * Reads 16 bytes of data from the device.
     * @param address The address to read from
     * @returns A buffer filled with the data we recieved. null if reading failed.
     */
    function read16Bytes(address: number) {

        authenticate(address);

        basic.pause(70);

        // InDataExchange: target 1 (0x01), 16 bytes reading (0x30)
        let command: number[] = [0xD4, 0x40, 0x01, 0x30, address];

        let fullCommand = makeCommand(command);

        if (DEBUG_SERIAL) {
            debug_message("Reading from address " + decToHex(address));
            printNrArrayAsHex(fullCommand);
        }

        writeBuffer(fullCommand);

        checkOutput(ACK_FRAME);

        // if successful, we'll receive an normal information frame (see 6.2.1.1 in UM) with 16 bytes of packet data
        let outputFrame = readFrame();

        return outputFrame;
    }

    /**
     * Writes 16 bytes to a specified address on the chip.
     * @param data The data to write. This array has to be a length of 16.
     * @param address The address to write to.
     * @returns true if writing the data to the tag was successful.
     */
    function write16Bytes(data: number[], address: number) {
    
        authenticate(address);

        if (DEBUG_SERIAL) {
            debug_message("writing to " + decToHex(address) + ": ");
            printNrArrayAsHex(data);
        }

        if (data.length != 16) {
            if (DEBUG_SERIAL)
                debug_message("You passed " + data.length + " bytes and not 16 for write16Bytes()");

        }

        let command = concatNumArr([0xD4, 0x40, targetID, 0xA0, address], data);

        let fullCommand = makeCommand(command);

        writeBuffer(fullCommand);

        checkOutput(ACK_FRAME);
    }

    /**
     * Concatenates 2 arrays
     * @param firstArr The first array.
     * @param secondArr The array to put at the end of the first.
     * @returns The array that is firstArr with secondArr at the end.
     */
    function concatNumArr(firstArr: number[], secondArr: number[]): number[]{

        let result: number[] = [];

        for (let i = 0; i < firstArr.length; i++) {
            result[i] = firstArr[i];
        }

        for (let i = 0; i < secondArr.length; i++) {
            result[firstArr.length + i] = secondArr[i];
        }

        return result;
    }

    /**
     * Prints an array of numbers to the console in hex representation.
     * @param arr The array of numbers to print.
     */
    function printNrArrayAsHex(arr: number[]): void {
        let result: string = "";
        for (let i = 0; i < arr.length; i++) {
            result += " " + decToHex(arr[i])
        }
        debug_message(result + "\n");
    }

    function printBufferAsHex(buf: Buffer): void {
        let result: string = "";
        for (let i = 0; i < buf.length; i++) {
            let m = buf.getNumber(NumberFormat.UInt8LE, i);
            result += " " + decToHex(m);
        }
        debug_message(result + "\n");
    }

    /**
     * Gets the hex number representation of a integer as a string.
     * @param decNr The nr to convert to hex
     * @returns a sequence of chars '1' - 'F' as string. This is at least 2 chars long.
     */
    function decToHex(decNr: number): string {
        if (decNr == 0) {
            return "00";
        }

        let chars: string[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F"];
        let result: string = "";
        let nrCopy = decNr;
        while (nrCopy > 0) {
            let remainder = nrCopy % 16;
            result = chars[remainder] + result;
            nrCopy = (nrCopy - remainder) / 16;
        }

        if (decNr < 17) {
            result = "0" + result;
        }

        return result;
    }

    /**
     * Waking up the device and
     * Disabling the Security Access Module (SAM) since we dont use it.
     */
    function wakeup(): void {
        // just to be sure...
        pins.i2cWriteNumber(ADDRESS, 0, NumberFormat.UInt8LE);
        basic.pause(100);

        // SAMConfiguration: normal mode (Page 89)
        // Mode 0x01 disables SAM
        const wakeup: number[] = [0x00, 0x00, 0xFF, 0x03, 0xFD, 0xD4, 0x14, 0x01, 0x17, 0x00];
        writeBuffer(wakeup);

        let validAck = checkOutput(ACK_FRAME);

        const wakeupOK: number[] = [0x01, 0x00, 0x00, 0xFF, 0x02, 0xFE, 0xD5, 0x15, 0x16];
        let validWakeupOK = checkOutput(wakeupOK);

        if (validAck && validWakeupOK) {
            running = true;
        } else {
            if (DEBUG_SERIAL)
                debug_message("Waking up failed!");
        }
    }

    function findPassiveTarget(): void {
        targetID = 0;
        targetNFCID = [0, 0, 0, 0];

        basic.showIcon(IconNames.SmallHeart);

        if (DEBUG_SERIAL) {
            debug_message("Suche NFC Tag (InListPassiveTarget)");
        }

        // InListPassiveTarget: 1 target, 106 kbps type A (ISO14443 Type A)
        const listTarget: number[] = [0x00, 0x00, 0xFF, 0x04, 0xFC, 0xD4, 0x4A, 0x01, 0x00, 0xE1, 0x00];
        writeBuffer(listTarget);

        checkOutput(ACK_FRAME);

        let outputFrame = readFrame();
        if (outputFrame[0] == 0x01 && outputFrame[8] == 0x01) {
            targetID = 1;
            targetNFCID[0] = outputFrame[14];
            targetNFCID[1] = outputFrame[15];
            targetNFCID[2] = outputFrame[16];
            targetNFCID[3] = outputFrame[17];

            if (DEBUG_SERIAL) {
                debug_message("NFC Tag gefunden!");
                printNrArrayAsHex(targetNFCID);
            }

            basic.showIcon(IconNames.Yes);
        } else {
            basic.showLeds(`
	          . # # . .
	          . . . # .
	          . . # . .
	          . . . . .
	          . . # . .
		  `) 

            if (DEBUG_SERIAL) {
                debug_message("Kein NFC Tag gefunden.");
                printBufferAsHex(outputFrame);
            }
        }
    }

    function makeCommand(command: number[]): number[]{
        let len = command.length;
        let length_checksum = 0x100 - (len % 0x100);

        let preCommand = [0x00, 0x00, 0xFF, len, length_checksum];

        let allBytes = 0;
        for (let i = 0; i < command.length; i++)
            allBytes += command[i];
        let data_checksum = 0x100 - (allBytes % 0x100);

        let postCommand = [data_checksum, 0x00];

        let fullCommand = concatNumArr(concatNumArr(preCommand, command), postCommand);

        return fullCommand;
    }

    function authenticate(address: number): boolean {
        // InDataExchange, authenticate with key A 0x60
        let command = concatNumArr([0xD4, 0x40, targetID, 0x60, address], concatNumArr(targetKey, targetNFCID));

        let fullCommand = makeCommand(command);

        if (DEBUG_SERIAL) {
            debug_message("Versuche zu authentifizieren: ");
            printNrArrayAsHex(fullCommand);
        }

        writeBuffer(fullCommand);
        checkOutput(ACK_FRAME);

        let authResponse = readFrame();
        let success = (authResponse[7] == 0x00);

        return success;
    }

    /**
      * Get NFC ID of the Tag at the antenna.
     */
    //% weight=212
    //% blockId=grove_pn532_getNFCID
    //% block="get the unique NFC ID of the Tag"
    //% parts="grove_pn532"
    export function getNFCID(): string {
        findPassiveTarget();
        
        if (targetID) {
          let result = "";
          for (let i=0;i<4;i++) result += decToHex(targetNFCID[i]);
          return result;
        } else {
          return "";
        }
    }

    /**
     * Converts number to string
     */
    //% weight=212
    //% blockId=grove_pn532_numberToString
    //% block="convert to string %nr"
    //% parts="grove_pn532"
    export function convertNrToString(nr: number): string {
        return "" + nr;
    }

    /**
     * Write text to Mifare Classic tag.
     */
    //% weight=210
    //% blockId=grove_pn532_textrecord_write
    //% block="write to NFC tag %message"
    //% parts="grove_pn532"
    export function writeText(message: string) {

        if (DEBUG_SERIAL)
            debug_message("Starting to write...");

        if (!running) {
            wakeup();
            basic.pause(50);
        }

        findPassiveTarget();

        if (targetID == 1) { //Did we find a device?
        
            basic.showIcon(IconNames.Square);

            if (DEBUG_SERIAL)
                debug_message("found target to write to");

            let maxStringLength = 16*dataBlocks.length;
            
            if (message.length > maxStringLength) {
                message = message.substr(0, maxStringLength);
                if (DEBUG_SERIAL)
                    debug_message("String length of " + message.length + "is too high.\nNeeds to be <=" + maxStringLength);
            }

            let blocksNeeded = message.length/16+1;
            
            let data : number[][] = [];
            
            for (let i=0;i<blocksNeeded;i++) {
              let blockData : number[] = [];
              let len = message.length - (blocksNeeded - 1)*16;
              
              if (i < blocksNeeded - 1) len = 16;
              
              for (let j=0;j<len;j++) blockData[j] = message.charCodeAt(i*16+j);
              for (let j=len;j<16;j++) blockData[j] = 0;
              
              data[i] = blockData;
            }
            
            // header block contains only the length of the text
            
            let header = [message.length];
            for (let k=1;k<16;k++) header[k] = 0;
            write16Bytes(header, 0x04);
            
            for (let j=0;j<blocksNeeded;j++) write16Bytes(data[j], dataBlocks[j]);
            

        } else {
            if (DEBUG_SERIAL)
                debug_message("Did not find a target when trying to write");
        }
        basic.clearScreen();
        if (DEBUG_SERIAL)
            debug_message("writing finished...");

    }

    // never write blocks 3+i*4 (sector trailers with keys)
    // data can be stored in 4,5,6,8,9,10,12,13,14

    /**
     * Read text from Mifare Classic tag.
     */
    //% weight=209
    //% blockId=grove_pn532_textrecord_read
    //% block="read text message in NFC tag"
    //% parts="grove_pn532"
    export function readText(): string {
        if (!running) {
            wakeup();
            basic.pause(50);
        }

        findPassiveTarget();

        let textMessage = "";
        if (targetID == 1) {
            let outputFrame = read16Bytes(0x04);
            let messageLength = outputFrame[9];
            
            let blocksNeeded = messageLength/16+1;
                        
            for (let j=0;j<blocksNeeded;j++) {
              let messageFrame = read16Bytes(dataBlocks[j]);
              
              let message = messageFrame.slice(9,16);
              let len = messageLength - (blocksNeeded-1)*16;
              if(j<blocksNeeded-1) len=16
              for (let i=0;i<len;i++) textMessage += String.fromCharCode(message.getNumber(NumberFormat.UInt8LE, i));
            }
        }

        if (DEBUG_SERIAL)
            debug_message("The found textMessage is\n" + textMessage);

        return textMessage;
    }
}
