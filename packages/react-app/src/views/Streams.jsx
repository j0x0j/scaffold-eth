import React, { useCallback, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { notification, InputNumber, Select, Button, List, Divider, Input, Card, DatePicker, Slider, Switch, Progress, Spin } from "antd";
import { SyncOutlined } from '@ant-design/icons';
import { Address, AddressInput, Balance, Blockie, EtherInput } from "../components";
import { parseEther, formatEther } from "@ethersproject/units";
import { ethers } from "ethers";
import { useContractReader, useEventListener, useLocalStorage, useBalance } from "../hooks";
import { useBlockNumber } from "eth-hooks";
const axios = require('axios');
const { Option } = Select;

const DEBUG = false

export default function Streams({contractName, ownerEvents, signaturesRequired, address, nonce, userProvider, mainnetProvider, localProvider, yourLocalBalance, price, tx, readContracts, writeContracts, blockExplorer }) {

  const walletBalance = useBalance(localProvider, readContracts?readContracts[contractName].address:readContracts);
  if(DEBUG) console.log("💵 walletBalance",walletBalance?formatEther(walletBalance):"...")

  //event OpenStream( address indexed to, uint256 amount, uint256 frequency );
  const openStreamEvents = useEventListener(readContracts, contractName, "OpenStream", localProvider, 1);
  if(DEBUG) console.log("📟 openStreamEvents:",openStreamEvents)

  const blockNumber = useBlockNumber(localProvider);
  if(DEBUG) console.log("# blockNumber:",blockNumber)

  const [streams, setStreams] = useState()
  const [streamInfo, setStreamInfo] = useState()

  useEffect(()=>{
      let getStreams = async ()=>{
        let newStreams = []
        let newStreamInfo = {}

        for(let s in openStreamEvents){
          if(openStreamEvents[s].to && newStreams.indexOf(openStreamEvents[s].to)<0){
            newStreams.push(openStreamEvents[s].to)
            console.log("GETTING STREAM BALANC OF ",openStreamEvents[s].to,"from",readContracts)
            try{
              let update = {}
              update.stream = await readContracts[contractName].streams(openStreamEvents[s].to)
              console.log("STREAM:",update.stream)
              if(update.stream && update.stream.amount.gt(0)){
                update.balance = await readContracts[contractName].streamBalance(openStreamEvents[s].to)
              }
              newStreamInfo[openStreamEvents[s].to] = update
            }catch(e){
              console.log(e)
            }

          }
        }
        setStreams(newStreams)
        setStreamInfo(newStreamInfo)
      }
      if(readContracts && readContracts[contractName]){
        getStreams()
      }
    },[ openStreamEvents, blockNumber ]
  )

  const history = useHistory();

  const [to, setTo] = useLocalStorage("to");
  const [amount, setAmount] = useLocalStorage("amount","0");
  const [methodName, setMethodName] = useLocalStorage("openStream");
  const [streamToAddress, setStreamToAddress] = useLocalStorage("streamToAddress");
  const [streamAmount, setStreamAmount] = useLocalStorage("streamAmount");
  const [streamFrequency, setStreamFrequency] = useLocalStorage("streamFrequency");
  const [data, setData] = useLocalStorage("data","0x");

  let streamDetailForm = ""
  let displayedStream = {}
  if(methodName=="openStream"){
    streamDetailForm = (
      <div>
        <div style={{margin:8,padding:8}}>
          <EtherInput
            price={price}
            placeholder="amount"
            value={streamAmount}
            onChange={setStreamAmount}
          />
        </div>
        <div style={{margin:8,padding:8}}>
          every <InputNumber
            width={200}
            placeholder="frequency"
            value={streamFrequency}
            onChange={setStreamFrequency}
          /> seconds
        </div>
      </div>
    )
  }

  return (
    <div>
      <List
        style={{maxWidth:400,margin:"auto",marginTop:32}}
        bordered
        dataSource={streams}
        renderItem={(item) => {
          let withdrawButtonOrBalance = ""
          if(streamInfo[item] && !streamInfo[item].balance){
            withdrawButtonOrBalance = (
              <div style={{opacity:0.5}}>closed</div>
            )
          } else if(address==item){
            withdrawButtonOrBalance = (
              <Button style={{paddingTop:-8}} onClick={()=>{
                if(streamInfo[item] && streamInfo[item].balance && streamInfo[item].balance.gt(walletBalance)){
                  notification.info({
                    message: "Warning: Contract Balance",
                    description: "It looks like there isn't enough in the contract to withdraw?",
                    placement: "bottomRight",
                  });
                }
                tx( writeContracts[contractName].streamWithdraw() )
              }}>
                { "$" + (parseFloat(formatEther(streamInfo[item]&&streamInfo[item].balance?streamInfo[item].balance:0)) * price).toFixed(2) }
              </Button>
            )
          }else{
            withdrawButtonOrBalance = (
              <Balance
                balance={streamInfo[item].balance}
                dollarMultiplier={price}
              />
            )
          }

          return (
            <List.Item key={"stream_"+item}>
              <Address
                value={item}
                ensProvider={mainnetProvider}
                blockExplorer={blockExplorer}
                fontSize={32}
              />
              {withdrawButtonOrBalance}
            </List.Item>
          )

        }}
      />

      <div style={{border:"1px solid #cccccc", padding:16, width:400, margin:"auto",marginTop:64}}>
        <div style={{margin:8,padding:8}}>
          <Select value={methodName} style={{ width: "100%" }} onChange={ setMethodName }>
            <Option key="openStream">openStream()</Option>
            <Option key="closeStream">closeStream()</Option>
          </Select>
        </div>
        <div style={{margin:8,padding:8}}>
          <AddressInput
            autoFocus
            ensProvider={mainnetProvider}
            placeholder="stream to address"
            value={streamToAddress}
            onChange={setStreamToAddress}
          />
        </div>
        {streamDetailForm}
        <div style={{margin:8,padding:8}}>
          <Button onClick={()=>{
            //console.log("METHOD",setMethodName)

            let calldata
            if(methodName=="openStream"){
              calldata = readContracts[contractName].interface.encodeFunctionData("openStream",[streamToAddress,parseEther(""+parseFloat(streamAmount).toFixed(12)),streamFrequency])
            }else{
              calldata = readContracts[contractName].interface.encodeFunctionData("closeStream",[streamToAddress])
            }
            console.log("calldata",calldata)
            setData(calldata)
            setAmount("0")
            setTo(readContracts[contractName].address)
            setTimeout(()=>{
              history.push('/create')
            },777)
          }}>
            Create Tx
          </Button>
        </div>
      </div>
    </div>
  );
}