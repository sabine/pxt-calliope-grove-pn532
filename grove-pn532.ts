/**
 * Functions for the Seeedstudio Grove NFC.
 * WIP: Reads NDEF text records from ISO14443-3A / Mifare
 *
 * @author Mirek Hancl, Alexander Pfanne
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
    let running = false;
    // if PN532 isn't running, no reading will be possible

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

        authenticate(address, [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);

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
     * Writes 4 bytes to a specified address on the chip.
     * @param data The data to write. This array has to be a length of 4.
     * @param address The address to write to.
     * @returns true if writing the data to the tag was successful.
     */
    function write4Bytes(data: number[], address: number) {

        if (DEBUG_SERIAL) {
            debug_message("writing to " + decToHex(address) + ": ");
            printNrArrayAsHex(data);
        }

        if (data.length != 4) {
            if (DEBUG_SERIAL)
                debug_message("You passed " + data.length + " bytes and not 4 for write4Bytes()");

        }

        if (address > 0x28) {
            //TODO: Support different devices.
            //We dont want to lock the nfc tag. This happens if we write to 0x29 on some tags.
            if (DEBUG_SERIAL) {
                debug_message("We tried to write to page " + decToHex(address) + ". Aborting!");
                debug_message("Tried to write the following data")
                printNrArrayAsHex(data);
            }

        }

        let command = concatNumArr([0xD4, 0x40, targetID, 0xA2, address], data);

        let fullCommand = makeCommand(command);

        writeBuffer(fullCommand);

        // check ack frame
        if (!checkOutput(ACK_FRAME)) {
            if (DEBUG_SERIAL)
                debug_message("ACK check failed!");

        }

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

        // check ack
        let validAck = checkOutput(ACK_FRAME);

        // check response
        const wakeupOK: number[] = [0x01, 0x00, 0x00, 0xFF, 0x02, 0xFE, 0xD5, 0x15, 0x16];
        let validWakeupOK = checkOutput(wakeupOK);

        // if something went wrong...
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

        // check ack frame
        checkOutput(ACK_FRAME);

        // check response
        let outputFrame = readFrame();
        if (outputFrame[0] == 0x01 && outputFrame[8] == 0x01) {
            targetID = 1;
            targetNFCID[0] = outputFrame[12];
            targetNFCID[1] = outputFrame[13];
            targetNFCID[2] = outputFrame[14];
            targetNFCID[3] = outputFrame[15];

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

    function authenticate(address: number, key: number[]): boolean {

        // InDataExchange, authenticate with key A 0x60
        let command = concatNumArr([0xD4, 0x40, targetID, 0x60, address], concatNumArr(key, targetNFCID));

        let fullCommand = makeCommand(command);

        if (DEBUG_SERIAL) {
            debug_message("Versuche zu authentifizieren: ");
            printNrArrayAsHex(fullCommand);
        }

        writeBuffer(fullCommand);

        checkOutput(ACK_FRAME);
        
        let authResponse = readFrame();
        let sucess = authResponse[7] == 0x00;
        
        if (DEBUG_SERIAL) {
          debug_message(success? "Erfolgreich.": "Fehlgeschlagen.")
        }
        
        return success;
    }

    /**
     * Formats a tag as ndef format.
     */
    export function formatAsNdef(): void {
        if (DEBUG_SERIAL)
            debug_message("Starting to format...");

        if (!running) {
            wakeup();
            basic.pause(50);
            // we have to wait...
        }

        findPassiveTarget();

        if (targetID == 1) { //Did we find a device?

            let address = 0x04;

            let page1 = [0x03, 0x04, 0xD8, 0x00];
            write4Bytes(page1, address++);

            let page2 = [0x00, 0x00, 0xFE, 0x00];
            write4Bytes(page2, address++);

            let zeroArr4 = [0x00, 0x00, 0x00, 0x00];
            while (address < 0x28) {
                write4Bytes(zeroArr4, address++);
            }

        } else {
            if (DEBUG_SERIAL)
                debug_message("Did not find a target when trying to format");
        }

        if (DEBUG_SERIAL)
            debug_message("formatting finished...");
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
     * Write NDEF text record to Mifare Ultralight tag.
     */
    //% weight=210
    //% blockId=grove_pn532_textrecord_write
    //% block="write to NFC tag %charsToWrite"
    //% parts="grove_pn532"
    export function writeNDEFText(charsToWrite: string) {
        basic.showIcon(IconNames.Square);

        if (DEBUG_SERIAL)
            debug_message("Starting to write...");

        if (!running) {
            wakeup();
            basic.pause(50);
            // we have to wait...
        }

        findPassiveTarget();

        if (targetID == 1) { //Did we find a device?

            if (DEBUG_SERIAL)
                debug_message("found target to write to");

            //FIXME: Redundent initilization of the tag?.
            formatAsNdef();
            //TODO: More safety checks with write4Bytes() return value

            //We can write to every page before 0x29 and after 0x03
            //We also have to reserve 1 bit for the 0xFE at the end.
            let maxStringLength = ((0x29 - 0x04) * 4) - 1;
            if (charsToWrite.length > maxStringLength) {
                if (DEBUG_SERIAL)
                    debug_message("String length of " + charsToWrite.length + "is too high.\nNeeds to be <=" + maxStringLength);
                return;
            }

            //First 4 pages are reserved and read only. The following 2 pages are NDEF information.
            let address = 0x04;

            //TODO: Do we want to do more than just short records?
            //First 2 pages are set. We always use a short record.
            //Second byte is the payload length.
            //6th byte is 'T' for the type of our entry (plain text).
            //7th byte is the length of the language code.
            //8th and 9th byte are the language code ("de" for german) in our case.
            let page1: number[] = [0x03, 0x07 + charsToWrite.length, 0xD1, 0x01];
            write4Bytes(page1, address++);
            //ToDo: 0x08 berechnen (Statusbyte+Ländercodebytes+Plaintextbytes)
            let page2: number[] = [charsToWrite.length + 0x03, 0x54, 0x02, 0x64];
            write4Bytes(page2, address++);
            let pageToAdd: number[] = [0x65];

            //Go through the string and write the string to the nfc tag 4 bytes at a time.
            let posInString = 0;
            while (posInString < charsToWrite.length) {
                pageToAdd[pageToAdd.length] = charsToWrite.charCodeAt(posInString++);

                if (pageToAdd.length == 4) {
                    write4Bytes(pageToAdd, address++);
                    pageToAdd = [];
                }
            }

            //We cycled through the whole string. Add 0xFE to signal the end of the entry
            pageToAdd[pageToAdd.length] = 0xFE;
            while (pageToAdd.length < 4) {
                //Fill with 0x00 because we always want to write exactly 4 bytes.
                pageToAdd[pageToAdd.length] = 0x00;
            }

            write4Bytes(pageToAdd, address++);

        } else {
            if (DEBUG_SERIAL)
                debug_message("Did not find a target when trying to write");
        }
        basic.clearScreen();
        if (DEBUG_SERIAL)
            debug_message("writing finished...");

    }

    /**
     * Read NDEF text record from Mifare Ultralight tag.
     */
    //% weight=209
    //% blockId=grove_pn532_textrecord_read
    //% block="read text message in NFC tag"
    //% parts="grove_pn532"
    export function readNDEFText(): string {
        if (!running) {
            wakeup();
            basic.pause(50);
            // we have to wait...
        }

        findPassiveTarget();

        let textMessage = "";
        if (targetID == 1) { //Did we find a device?
            if (DEBUG_SERIAL) {
                for (let j = 1; j < 16; j++)
                    read16Bytes(j);
            }

            let outputFrame = read16Bytes(0x04);
            if (outputFrame != null) {
                let startByte = -1;
                let messageLength = -1;
                // skip RDY, PREAMBLE, START CODE, LEN, LCS, TFI, COMMAND CODE, STATUS
                // skip also DCS, POSTAMBLE at the end
                for (let l = 9; l < outputFrame.length - 2; l++) {
                    let m = outputFrame.getNumber(NumberFormat.UInt8LE, l);
                    let n = outputFrame.getNumber(NumberFormat.UInt8LE, l + 5);
                    //where is the first NDEF message with message type == text?
                    if (m == 0x03 &&
                        n == 0x54) {

                        //The last 6 bits (0x3F) of the status byte are the length of the IANA language code field
                        // Text length = messageLength - language code length - 1
                        messageLength = outputFrame.getNumber(NumberFormat.UInt8LE, l + 4) -
                            (outputFrame.getNumber(NumberFormat.UInt8LE, l + 6) & 0x3F) - 1;

                        startByte = l + 7 + (outputFrame.getNumber(NumberFormat.UInt8LE, l + 6) & 0x3F);

                        if (DEBUG_SERIAL)
                            debug_message("found NDEF message with message type text at " + startByte + " and length " + messageLength);

                        break;
                    }
                }

                if (startByte != -1 && messageLength > 0) {

                    let amountRead = 27 - startByte - 2; // 27 bytes normal information frame w/ 16 bytes packet data, whereof 2 for postamble and data checksum
                    let currentPage = 0x04;
                    while (true) {

                        if (DEBUG_SERIAL)
                            debug_message("reading byte " + startByte + " from page " + decToHex(currentPage));

                        if (startByte >= outputFrame.length - 2) {
                            //We need to read more bytes

                            messageLength -= amountRead;

                            if (DEBUG_SERIAL)
                                debug_message("messageLength left: " + messageLength);

                            if (messageLength <= 0) {
                                //Reached the end of input.
                                break;
                            }

                            startByte = 9;
                            currentPage += 0x04; //We read 4 pages, read the next ones now
                            if (DEBUG_SERIAL)
                                debug_message("Getting a new page with address " + decToHex(currentPage));
                            outputFrame = read16Bytes(currentPage);
                            amountRead = 16;

                            if (outputFrame == null) {
                                //Something has gone terribly wrong. abort!
                                if (DEBUG_SERIAL)
                                    debug_message("error reading from address " + decToHex(currentPage) + "! Aborting");
                                break;
                            }

                        }

                        if (outputFrame.getNumber(NumberFormat.UInt8LE, startByte) == 0xFE) {
                            //We reached the end of our record. Stop reading.
                            //Theoretically we should not reach here since we read till exectly the character before
                            if (DEBUG_SERIAL)
                                debug_message("Found end of record (0xFE)! This shouldnt happen..");
                            break;
                        }

                        //ToDo: read UTF-8
                        textMessage += String.fromCharCode(outputFrame.getNumber(NumberFormat.UInt8LE, startByte));
                        startByte++;
                        if (DEBUG_SERIAL)
                            debug_message("Got char " + String.fromCharCode(outputFrame.getNumber(NumberFormat.UInt8LE, startByte)));
                    }
                }
            }
        }

        if (DEBUG_SERIAL)
            debug_message("The found textMessage is\n" + textMessage);

        return textMessage;
    }
}
