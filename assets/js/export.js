/**
 * export.js — Exportação/Importação de sequências
 * Módulo independente registrado em window.PS.
 */
(function(){'use strict';var PS=window.PS=window.PS||{},Swal=window.Swal;

function copyTextareaContent(textareaId,feedbackEl,successMsg){
  var el=document.getElementById(textareaId);
  if(!el||!el.value)return;
  function report(r){
    if(!feedbackEl)return;
    feedbackEl.textContent=r?successMsg:'Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.';
    feedbackEl.classList.toggle('error',!r);
  }
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(el.value).then(function(){report(true);}).catch(function(){report(false);});
  }else{
    el.select();document.execCommand('copy');report(true);
  }
}

function openExportModal(){
  var modal=document.getElementById('export-modal'),seqText=document.getElementById('export-seq-text'),
      linkText=document.getElementById('export-seq-link'),feedback=document.getElementById('export-feedback');
  if(!modal||!seqText||!linkText)return;
  var dnaSeq=PS.readSequence?PS.readSequence():'';
  seqText.value=dnaSeq;
  var url=new URL(window.location.href);
  url.search='';
  if(dnaSeq)url.searchParams.set('seq',dnaSeq);
  linkText.value=url.toString();
  if(feedback){feedback.textContent=dnaSeq?'':'A sequência está vazia — insira bases no simulador antes de exportar.';feedback.classList.toggle('error',!dnaSeq);}
  if(PS.openModalDialog)PS.openModalDialog(modal);
}

function openImportModal(){
  var modal=document.getElementById('import-modal');
  if(PS.openModalDialog)PS.openModalDialog(modal);
}

function handleImportSubmit(){
  if(typeof Swal==='undefined')return;
  var input=document.getElementById('import-seq-input'),feedback=document.getElementById('import-feedback');
  if(!input)return;
  var raw=input.value.trim();
  if(!raw){Swal.fire({type:'error',title:'Nada a importar',text:'Cole uma sequência de DNA no campo acima primeiro.'});return;}
  if(PS.sanitizeDnaInput&&PS.loadSequenceFromString&&PS.closeModal){
    var clean=PS.sanitizeDnaInput(raw);
    if(clean.length===0){Swal.fire({type:'error',title:'Sequência inválida',text:'Nenhuma base válida (A, T, C, G) encontrada no texto colado.'});return;}
    PS.loadSequenceFromString(clean);
    if(feedback)feedback.textContent='';
    PS.closeModal(document.getElementById('import-modal'));
    if(typeof Swal!=='undefined')Swal.fire({type:'success',title:'Sequência importada!',text:clean.length+' bases carregadas no simulador.',timer:2000,showConfirmButton:false});
  }
}

PS.openExportModal=openExportModal;PS.openImportModal=openImportModal;PS.handleImportSubmit=handleImportSubmit;PS.copyTextareaContent=copyTextareaContent;

})();